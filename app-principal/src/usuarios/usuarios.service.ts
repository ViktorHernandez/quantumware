import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SupabaseAdminService } from './supabase-admin.service';
import { AsignarRolDto } from './dto/asignar-rol.dto';
import { ConsultaUsuariosDto } from './dto/consulta-usuarios.dto';
import { InvitarUsuarioDto } from './dto/invitar-usuario.dto';
import { CredencialTokenService } from '../cuenta/credencial-token.service';
import { CuentaService } from '../cuenta/cuenta.service';

const INVITACION_VIGENCIA_HORAS = 72;

interface FilaUsuario {
  user_id: string;
  rol: string | null;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  actualizado: Date | null;
}

const ORDEN: Record<string, string> = {
  nombre: 'p.nombre',
  email: 'p.email',
  rol: 'ur.rol',
  actualizado: 'p.actualizado',
};

@Injectable()
export class UsuariosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificaciones: NotificacionesService,
    private readonly admin: SupabaseAdminService,
    private readonly config: ConfigService,
    private readonly tokens: CredencialTokenService,
    private readonly cuenta: CuentaService,
  ) {}

  async listar(consulta: ConsultaUsuariosDto = {}) {
    const valores: unknown[] = [];
    const condiciones: string[] = [];
    if (consulta.rol === 'sin_rol') {
      condiciones.push('ur.rol IS NULL');
    } else if (consulta.rol) {
      valores.push(consulta.rol);
      condiciones.push(`ur.rol = $${valores.length}`);
    }
    if (consulta.q) {
      valores.push(`%${consulta.q}%`);
      condiciones.push(
        `(p.nombre ILIKE $${valores.length} OR p.email ILIKE $${valores.length} OR ids.user_id::text ILIKE $${valores.length})`,
      );
    }
    const where = condiciones.length
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';
    const columna = ORDEN[consulta.orden ?? 'rol'] ?? 'ur.rol';
    const direccion = consulta.direccion === 'desc' ? 'DESC' : 'ASC';

    const r = await this.db.query<FilaUsuario>(
      `SELECT ids.user_id, ur.rol, p.nombre, p.telefono, p.email, p.actualizado
       FROM (
         SELECT user_id FROM user_roles
         UNION
         SELECT user_id FROM perfil_usuario
       ) ids
       LEFT JOIN user_roles ur ON ur.user_id = ids.user_id
       LEFT JOIN perfil_usuario p ON p.user_id = ids.user_id
       ${where}
       ORDER BY ${columna} ${direccion} NULLS LAST`,
      valores,
    );

    const enriquecer = await this.admin.usuariosPorId();
    const items = r.rows.map((f) => {
      const extra = enriquecer.get(f.user_id);
      return {
        user_id: f.user_id,
        email: f.email ?? extra?.email ?? null,
        nombre: f.nombre,
        telefono: f.telefono,
        rol: f.rol,
        estado: f.rol ? 'activo' : 'sin rol asignado',
        tienePerfil: f.nombre !== null || f.email !== null,
        actualizado: f.actualizado,
        ultimoAcceso: extra?.ultimoAcceso ?? null,
      };
    });

    return {
      items,
      adminConfigurado: this.admin.configurado(),
    };
  }

  async asignar(dto: AsignarRolDto, solicitanteSub: string) {
    if (dto.user_id === solicitanteSub && dto.rol !== 'admin') {
      throw new BadRequestException(
        'No puedes retirarte a ti mismo el rol de administrador.',
      );
    }
    const previo = await this.db.query<{ rol: string }>(
      'SELECT rol FROM user_roles WHERE user_id = $1',
      [dto.user_id],
    );
    await this.db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET rol = EXCLUDED.rol`,
      [dto.user_id, dto.rol],
    );
    if (previo.rows[0]?.rol !== dto.rol) {
      await this.notificaciones.crear({
        userId: dto.user_id,
        tipo: 'rol_cambiado',
        titulo: 'Tu rol cambió',
        mensaje: `Un administrador asignó el rol "${dto.rol}" a tu cuenta.`,
        datos: { rol: dto.rol },
      });
    }
    return this.listar();
  }

  async invitar(dto: InvitarUsuarioDto, adminSub: string) {
    const email = dto.email.trim().toLowerCase();
    const pendiente = await this.db.query(
      `SELECT 1 FROM invitacion WHERE lower(email) = $1 AND estado = 'pendiente'`,
      [email],
    );
    if (pendiente.rowCount && pendiente.rowCount > 0) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para este correo. Revócala antes de enviar otra.',
      );
    }
    const existente = await this.db.query(
      'SELECT 1 FROM perfil_usuario WHERE lower(email) = $1',
      [email],
    );
    if (existente.rowCount && existente.rowCount > 0) {
      throw new ConflictException(
        'Ya existe una cuenta registrada con este correo.',
      );
    }
    this.cuenta.baseWeb();

    const r = await this.db.transaction(async (client) => {
      const invitacion = await client.query<{ id: string; expira_en: string }>(
        `INSERT INTO invitacion (email, rol, creada_por, expira_en)
         VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval)
         RETURNING id, expira_en`,
        [email, dto.rol, adminSub, String(INVITACION_VIGENCIA_HORAS)],
      );
      const fila = invitacion.rows[0];
      await this.tokens.anularVigentes('invitacion', email, client);
      const emitido = await this.tokens.emitir(
        {
          tipo: 'invitacion',
          email,
          rol: dto.rol,
          invitacionId: fila.id,
          minutosVigencia: INVITACION_VIGENCIA_HORAS * 60,
        },
        client,
      );
      await this.cuenta.encolarCorreoEnlace(
        'invitacion',
        email,
        emitido.token,
        emitido.id,
      );
      return { rows: [fila] };
    });

    await this.notificaciones.crearParaAdmins({
      tipo: 'invitacion_enviada',
      titulo: 'Invitación de usuario enviada',
      mensaje: `Se envió una invitación con rol "${dto.rol}" a ${email}. Expira en ${INVITACION_VIGENCIA_HORAS} horas.`,
      claveDedupe: `invitacion:${r.rows[0].id}`,
    });
    return {
      id: r.rows[0].id,
      email,
      rol: dto.rol,
      estado: 'pendiente',
      expira_en: r.rows[0].expira_en,
    };
  }

  async listarInvitaciones() {
    await this.db.query(
      `UPDATE invitacion SET estado = 'expirada'
       WHERE estado = 'pendiente' AND expira_en < now()`,
    );
    const r = await this.db.query(
      `SELECT id, email, rol, estado, expira_en, creado_en, aceptada_en
       FROM invitacion ORDER BY creado_en DESC LIMIT 100`,
    );
    return { items: r.rows };
  }

  async revocarInvitacion(id: string) {
    const r = await this.db.query<{
      estado: string;
      usuario_sub: string | null;
      email: string;
    }>('SELECT estado, usuario_sub, email FROM invitacion WHERE id = $1', [id]);
    if (r.rowCount === 0) {
      throw new NotFoundException('Invitación no encontrada.');
    }
    if (r.rows[0].estado !== 'pendiente') {
      throw new BadRequestException(
        'Solo pueden revocarse invitaciones pendientes.',
      );
    }
    if (r.rows[0].usuario_sub) {
      const eliminado = await this.admin.eliminarUsuario(r.rows[0].usuario_sub);
      if (!eliminado.ok) {
        throw new ServiceUnavailableException(
          `No se pudo invalidar el enlace de la invitación: ${eliminado.mensaje}`,
        );
      }
    }
    await this.db.transaction(async (client) => {
      await this.tokens.anularVigentes('invitacion', r.rows[0].email, client);
      await client.query(
        `UPDATE invitacion SET estado = 'revocada' WHERE id = $1`,
        [id],
      );
    });
    return { id, estado: 'revocada' };
  }

  async aplicarInvitacion(sub: string, email: string): Promise<string | null> {
    const correo = email.trim().toLowerCase();
    if (!correo) {
      return null;
    }
    const r = await this.db.query<{
      id: string;
      rol: string;
      expirada: boolean;
    }>(
      `SELECT id, rol, expira_en < now() AS expirada
       FROM invitacion WHERE lower(email) = $1 AND estado = 'pendiente'`,
      [correo],
    );
    if (r.rowCount === 0) {
      return null;
    }
    const inv = r.rows[0];
    if (inv.expirada) {
      await this.db.query(
        `UPDATE invitacion SET estado = 'expirada' WHERE id = $1`,
        [inv.id],
      );
      return null;
    }
    await this.db.transaction(async (cliente) => {
      await cliente.query(
        `UPDATE invitacion SET estado = 'aceptada', aceptada_en = now(), usuario_sub = $2
         WHERE id = $1`,
        [inv.id, sub],
      );
      await cliente.query(
        `INSERT INTO user_roles (user_id, rol) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET rol = EXCLUDED.rol`,
        [sub, inv.rol],
      );
    });
    return inv.rol;
  }

  async eliminarCuenta(subObjetivo: string, adminSub: string) {
    if (subObjetivo === adminSub) {
      throw new BadRequestException(
        'No puedes eliminar tu propia cuenta desde el panel de administración.',
      );
    }
    const rol = await this.db.query<{ rol: string }>(
      'SELECT rol FROM user_roles WHERE user_id = $1',
      [subObjetivo],
    );
    if (rol.rows[0]?.rol === 'admin') {
      const admins = await this.db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM user_roles WHERE rol = 'admin'`,
      );
      if (Number(admins.rows[0].n) <= 1) {
        throw new BadRequestException(
          'No puede eliminarse la única cuenta de administrador.',
        );
      }
    }
    const eliminado = await this.admin.eliminarUsuario(subObjetivo);
    if (!eliminado.ok) {
      throw new ServiceUnavailableException(
        `No se pudo eliminar la cuenta en el proveedor de identidad: ${eliminado.mensaje}`,
      );
    }
    const perfil = await this.db.query<{ email: string | null }>(
      'SELECT email FROM perfil_usuario WHERE user_id = $1',
      [subObjetivo],
    );
    const email = perfil.rows[0]?.email?.toLowerCase() ?? null;
    await this.db.transaction(async (cliente) => {
      if (email) {
        await cliente.query(
          `UPDATE invitacion SET estado = 'revocada'
           WHERE lower(email) = $1 AND estado = 'pendiente'`,
          [email],
        );
        await cliente.query(
          `DELETE FROM correo_salida
           WHERE lower(destinatario) = $1 AND estado = 'pendiente'`,
          [email],
        );
      }
      await cliente.query('DELETE FROM notificacion WHERE user_id = $1', [
        subObjetivo,
      ]);
      await cliente.query('DELETE FROM user_roles WHERE user_id = $1', [
        subObjetivo,
      ]);
      await cliente.query('DELETE FROM perfil_usuario WHERE user_id = $1', [
        subObjetivo,
      ]);
    });
    await this.notificaciones.crearParaAdmins({
      tipo: 'cuenta_eliminada',
      titulo: 'Cuenta de usuario eliminada',
      mensaje:
        'Un administrador eliminó una cuenta de usuario. Los pedidos y movimientos históricos se conservan para auditoría.',
      claveDedupe: `cuenta-eliminada:${subObjetivo}`,
    });
    return { user_id: subObjetivo, eliminada: true };
  }
}
