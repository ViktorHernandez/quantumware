import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { CorreoSalidaService } from '../correo/correo-salida.service';
import { asuntoCorreo, plantillaCorreo } from '../correo/plantilla-correo';
import { SupabaseAdminService } from '../usuarios/supabase-admin.service';
import {
  CredencialTokenService,
  MotivoInvalido,
  TipoToken,
} from './credencial-token.service';

export interface EstadoEnlace {
  valido: boolean;
  tipo: TipoToken | null;
  email: string | null;
  motivo: MotivoInvalido | null;
  mensaje: string | null;
}

export interface ResultadoEstablecer {
  ok: boolean;
  tipo: TipoToken | null;
  email: string | null;
  mensaje: string | null;
}

const MINUTOS_RECUPERACION = 60;
const LIMITE_SOLICITUDES = 3;
const VENTANA_LIMITE_MINUTOS = 15;

const MENSAJES: Record<MotivoInvalido, string> = {
  formato: 'El enlace no tiene un formato válido. Solicita uno nuevo.',
  inexistente: 'El enlace no es válido. Solicita uno nuevo.',
  expirado: 'El enlace expiró. Solicita uno nuevo.',
  usado: 'El enlace ya fue utilizado. Solicita uno nuevo.',
  anulado:
    'El enlace quedó sin efecto porque se generó uno más reciente. Usa el último correo recibido.',
};

@Injectable()
export class CuentaService {
  private readonly registro = new Logger(CuentaService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly tokens: CredencialTokenService,
    private readonly admin: SupabaseAdminService,
    private readonly correo: CorreoSalidaService,
    private readonly config: ConfigService,
  ) {}

  baseWeb(): string {
    const configurada = this.config.get<string>(
      'APP_WEB_URL',
      'http://localhost:5173',
    );
    try {
      const url = new URL(configurada);
      if (
        url.protocol !== 'https:' &&
        url.hostname !== 'localhost' &&
        url.hostname !== '127.0.0.1'
      ) {
        throw new Error('origen no permitido');
      }
      return url.origin;
    } catch {
      throw new ServiceUnavailableException(
        'APP_WEB_URL no es válida. Configura la URL pública raíz de QuantumWare.',
      );
    }
  }

  enlaceDe(tipo: TipoToken, token: string): string {
    const ruta =
      tipo === 'invitacion' ? '/aceptar-invitacion' : '/restablecer-contrasena';
    return `${this.baseWeb()}${ruta}?token=${token}`;
  }

  async encolarCorreoEnlace(
    tipo: TipoToken,
    email: string,
    token: string,
    tokenId: string,
  ): Promise<void> {
    const enlace = this.enlaceDe(tipo, token);
    const titulo =
      tipo === 'invitacion'
        ? 'Invitación para crear tu cuenta'
        : 'Restablecer tu contraseña';
    const mensaje =
      tipo === 'invitacion'
        ? 'Un administrador te invitó a QuantumWare. Abre el enlace para establecer tu contraseña y activar tu cuenta.'
        : 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Abre el enlace para establecer una contraseña nueva.';
    const vigencia =
      tipo === 'invitacion'
        ? 'El enlace puede usarse una sola vez.'
        : `El enlace caduca en ${MINUTOS_RECUPERACION} minutos y puede usarse una sola vez.`;

    await this.correo.encolar({
      destinatario: email,
      asunto: asuntoCorreo(titulo),
      html: plantillaCorreo({
        titulo,
        mensaje: `${mensaje} ${vigencia}`,
        detalles: [{ etiqueta: 'Enlace', valor: enlace }],
      }),
      texto: `${mensaje} ${vigencia}\n\n${enlace}`,
      claveDedupe: `cuenta:${tipo}:${tokenId}`,
    });
  }

  async solicitarRecuperacion(email: string): Promise<void> {
    const destino = email.trim().toLowerCase();
    const recientes = await this.tokens.emitidosDesde(
      'recuperacion',
      destino,
      VENTANA_LIMITE_MINUTOS,
    );
    if (recientes >= LIMITE_SOLICITUDES) {
      this.registro.warn(
        `Solicitud de recuperación limitada por frecuencia (${recientes} en ${VENTANA_LIMITE_MINUTOS} min).`,
      );
      return;
    }

    const cuenta = await this.admin.buscarPorEmail(destino);
    if (!cuenta) {
      const local = await this.db.query<{ user_id: string }>(
        'SELECT user_id FROM perfil_usuario WHERE lower(email) = $1',
        [destino],
      );
      if (local.rowCount === 0) {
        this.registro.log(
          'Solicitud de recuperación para un correo sin cuenta asociada.',
        );
        return;
      }
      await this.emitirYEnviar('recuperacion', destino, local.rows[0].user_id);
      return;
    }
    await this.emitirYEnviar('recuperacion', destino, cuenta.sub);
  }

  private async emitirYEnviar(
    tipo: TipoToken,
    email: string,
    usuarioSub: string,
  ): Promise<void> {
    await this.db.transaction(async (client) => {
      await this.tokens.anularVigentes(tipo, email, client);
      const emitido = await this.tokens.emitir(
        {
          tipo,
          email,
          usuarioSub,
          minutosVigencia: MINUTOS_RECUPERACION,
        },
        client,
      );
      await this.encolarCorreoEnlace(tipo, email, emitido.token, emitido.id);
    });
  }

  async inspeccionar(token: string): Promise<EstadoEnlace> {
    const estado = await this.tokens.inspeccionar(token);
    if (!estado.valido) {
      return {
        valido: false,
        tipo: null,
        email: null,
        motivo: estado.motivo,
        mensaje: MENSAJES[estado.motivo],
      };
    }
    return {
      valido: true,
      tipo: estado.datos.tipo,
      email: estado.datos.email,
      motivo: null,
      mensaje: null,
    };
  }

  async establecerContrasena(
    token: string,
    password: string,
  ): Promise<ResultadoEstablecer> {
    return this.db.transaction<ResultadoEstablecer>(async (client) => {
      const consumo = await this.tokens.consumir(token, client);
      if (!consumo.valido) {
        return {
          ok: false,
          tipo: null,
          email: null,
          mensaje: MENSAJES[consumo.motivo],
        };
      }
      const datos = consumo.datos;

      if (datos.tipo === 'recuperacion') {
        if (!datos.usuarioSub) {
          throw new ServiceUnavailableException(
            'El enlace no tiene una cuenta asociada.',
          );
        }
        const r = await this.admin.actualizarContrasena(
          datos.usuarioSub,
          password,
        );
        if (!r.ok) {
          throw new ServiceUnavailableException(
            `No fue posible actualizar la contraseña: ${r.mensaje}`,
          );
        }
        return {
          ok: true,
          tipo: 'recuperacion',
          email: datos.email,
          mensaje: null,
        };
      }

      const existente = await this.admin.buscarPorEmail(datos.email);
      let sub: string;
      if (existente) {
        const r = await this.admin.actualizarContrasena(
          existente.sub,
          password,
        );
        if (!r.ok) {
          throw new ServiceUnavailableException(
            `No fue posible activar la cuenta: ${r.mensaje}`,
          );
        }
        sub = existente.sub;
      } else {
        const r = await this.admin.crearConContrasena(datos.email, password);
        if (!r.ok) {
          throw new ServiceUnavailableException(
            `No fue posible crear la cuenta: ${r.mensaje}`,
          );
        }
        sub = r.sub;
      }

      const rol = datos.rol === 'admin' ? 'admin' : 'cliente';
      await client.query(
        `INSERT INTO perfil_usuario (user_id, email)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email`,
        [sub, datos.email],
      );
      await client.query(
        `INSERT INTO user_roles (user_id, rol) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET rol = EXCLUDED.rol`,
        [sub, rol],
      );
      if (datos.invitacionId) {
        await client.query(
          `UPDATE invitacion
           SET estado = 'aceptada', aceptada_en = now(), usuario_sub = $2
           WHERE id = $1 AND estado = 'pendiente'`,
          [datos.invitacionId, sub],
        );
      }
      return {
        ok: true,
        tipo: 'invitacion',
        email: datos.email,
        mensaje: null,
      };
    });
  }
}
