import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RANURA_EXPIRADO, SesionService } from './sesion.service';
import { enmascararToken } from './enmascarar';
import type { OrigenToken } from './escenarios';

export { enmascararToken };

export interface ParametrosSolicitud {
  metodo: string;
  ruta: string;
  origenToken: OrigenToken;
  tokenManual?: string;
  cuerpo?: unknown;
  cabeceras?: Record<string, string>;
}

export interface ResultadoSolicitud {
  request: {
    metodo: string;
    url: string;
    envioToken: boolean;
    origenToken: OrigenToken;
    tokenEnmascarado: string | null;
    tokenExpiradoAlEnviar: boolean | null;
    cabeceras: Record<string, string>;
    cuerpo?: unknown;
  };
  response: {
    status: number;
    tiempoMs: number;
    cuerpo: unknown;
  };
}

const LOOPBACK = ['localhost', '127.0.0.1', '::1'];

const CABECERAS_BLOQUEADAS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'expect',
]);

function decodificarPayload(token: string): Record<string, unknown> | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }
  try {
    const normalizado = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno =
      normalizado + '='.repeat((4 - (normalizado.length % 4)) % 4);
    const contenido: unknown = JSON.parse(
      Buffer.from(relleno, 'base64').toString('utf8'),
    );
    if (
      typeof contenido !== 'object' ||
      contenido === null ||
      Array.isArray(contenido)
    ) {
      return null;
    }
    return contenido as Record<string, unknown>;
  } catch {
    return null;
  }
}

function base64url(objeto: unknown): string {
  return Buffer.from(JSON.stringify(objeto))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function esIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function esIpPrivadaOReservada(host: string): boolean {
  const limpio = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (limpio === '::1' || limpio.startsWith('fc') || limpio.startsWith('fd')) {
    return true;
  }
  if (limpio.startsWith('fe80')) {
    return true;
  }
  if (!esIpv4(limpio)) {
    return false;
  }
  const o = limpio.split('.').map((n) => Number(n));
  if (o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  if (o[0] === 10 || o[0] === 127 || o[0] === 0) {
    return true;
  }
  if (o[0] === 169 && o[1] === 254) {
    return true;
  }
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) {
    return true;
  }
  if (o[0] === 192 && o[1] === 168) {
    return true;
  }
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) {
    return true;
  }
  return false;
}

@Injectable()
export class MotorService {
  constructor(
    private readonly config: ConfigService,
    private readonly sesion: SesionService,
  ) {}

  baseObjetivo(): string {
    return this.config.get<string>('TARGET_BASE_URL', 'http://localhost:3000');
  }

  private produccion(): boolean {
    return this.config.get<string>('NODE_ENV', 'development') === 'production';
  }

  private destinosPermitidos(): Set<string> {
    const permitidos = new Set<string>();
    try {
      permitidos.add(new URL(this.baseObjetivo()).hostname.toLowerCase());
    } catch {
      permitidos.clear();
    }
    const lista = this.config.get<string>('TARGET_ALLOWLIST', '');
    for (const h of lista.split(',')) {
      const limpio = h.trim().toLowerCase();
      if (limpio) {
        permitidos.add(limpio);
      }
    }
    if (!this.produccion()) {
      LOOPBACK.forEach((h) => permitidos.add(h));
    }
    return permitidos;
  }

  private validarObjetivo(url: URL): void {
    const host = url.hostname.toLowerCase();
    const esLoopback = LOOPBACK.includes(host);
    if (url.protocol !== 'https:' && !esLoopback) {
      throw new BadRequestException(
        'El cliente de pruebas solo admite HTTPS hacia el destino autorizado (o HTTP solo en localhost).',
      );
    }
    if (!this.destinosPermitidos().has(host)) {
      throw new BadRequestException(
        'Destino no autorizado. El cliente de pruebas solo puede dirigirse a la aplicación QuantumWare configurada.',
      );
    }
    if (esIpPrivadaOReservada(host) && !(esLoopback && !this.produccion())) {
      throw new BadRequestException(
        'Destino no permitido: direcciones privadas, de enlace local o de metadatos están bloqueadas.',
      );
    }
  }

  async modoObjetivo(): Promise<string> {
    try {
      const url = new URL(`${this.baseObjetivo()}/salud`);
      this.validarObjetivo(url);
      const r = await fetch(url.toString());
      const d = (await r.json()) as { vulnMode?: string };
      return d.vulnMode ?? 'desconocido';
    } catch {
      return 'desconocido';
    }
  }

  private suplantarSub(token: string | null): string | null {
    if (!token) {
      return null;
    }
    const partes = token.split('.');
    const payload = decodificarPayload(token);
    if (partes.length !== 3 || !payload) {
      return token ? `${token}x` : null;
    }
    payload.sub = '00000000-0000-0000-0000-000000000000';
    partes[1] = base64url(payload);
    return partes.join('.');
  }

  private estaExpirado(token: string | null): boolean | null {
    if (!token) {
      return null;
    }
    const payload = decodificarPayload(token.trim());
    if (payload && typeof payload.exp === 'number') {
      return payload.exp * 1000 < Date.now();
    }
    return null;
  }

  private resolverToken(
    origen: OrigenToken,
    tokenManual?: string,
  ): { token: string | null; expirado: boolean | null } {
    let token: string | null = null;
    switch (origen) {
      case 'ninguno':
        return { token: null, expirado: null };
      case 'admin':
        token = this.sesion.token('admin');
        if (!token) {
          throw new BadRequestException(
            'Este escenario requiere la sesión de administrador y no está capturada. Captúrala en «Sesiones» antes de ejecutarlo; no se envía la solicitud sin token para evitar un resultado engañoso.',
          );
        }
        break;
      case 'cliente':
        token = this.sesion.token('cliente');
        if (!token) {
          throw new BadRequestException(
            'Este escenario requiere la sesión de cliente y no está capturada. Captúrala en «Sesiones» antes de ejecutarlo.',
          );
        }
        break;
      case 'alterado': {
        const base = this.sesion.token('cliente');
        if (!base) {
          throw new BadRequestException(
            'PA-03 altera el token de cliente, pero la sesión de cliente no está capturada. Captúrala en «Sesiones» antes de ejecutarlo.',
          );
        }
        token = this.suplantarSub(base);
        break;
      }
      case 'expirado': {
        const manual = (tokenManual ?? '').trim();
        const candidato =
          manual.length > 0 ? manual : this.sesion.token(RANURA_EXPIRADO);
        if (!candidato) {
          throw new BadRequestException(
            'PA-04 necesita un token ya vencido. Pulsa «Generar token expirado» en «Sesiones» y ejecuta PA-04 dejando el campo de token vacío, o pega un token completo cuya marca "exp" ya haya pasado.',
          );
        }
        const payload = decodificarPayload(candidato.trim());
        if (!payload || typeof payload.exp !== 'number') {
          throw new BadRequestException(
            'El texto indicado para PA-04 no es un JWT completo (tres segmentos separados por puntos). Suele ocurrir al copiar el token acortado que se muestra enmascarado: deja el campo vacío para usar el token de laboratorio ya generado, o pega el token completo con el botón de copiar.',
          );
        }
        if (payload.exp * 1000 >= Date.now()) {
          const restante = Math.max(
            0,
            Math.round((payload.exp * 1000 - Date.now()) / 1000),
          );
          throw new BadRequestException(
            `El token indicado para PA-04 todavía es válido: faltan ${restante} segundo(s) para que expire. Genera un token de laboratorio expirado o pega uno cuya marca "exp" ya haya pasado.`,
          );
        }
        token = candidato.trim();
        break;
      }
      case 'personalizado':
        token = tokenManual ?? null;
        break;
    }
    return { token, expirado: this.estaExpirado(token) };
  }

  async ejecutar(params: ParametrosSolicitud): Promise<ResultadoSolicitud> {
    if (!params.ruta.startsWith('/')) {
      throw new BadRequestException('La ruta debe comenzar con "/".');
    }
    const url = new URL(this.baseObjetivo() + params.ruta);
    this.validarObjetivo(url);

    const { token, expirado } = this.resolverToken(
      params.origenToken,
      params.tokenManual,
    );
    const cabeceras: Record<string, string> = {};
    for (const [nombre, valor] of Object.entries(params.cabeceras ?? {})) {
      const clave = nombre.trim().toLowerCase();
      if (CABECERAS_BLOQUEADAS.has(clave)) {
        throw new BadRequestException(
          `La cabecera "${nombre}" no se admite: podría alterar el enrutamiento o el cuerpo de la solicitud. Cabeceras bloqueadas: ${[...CABECERAS_BLOQUEADAS].join(', ')}.`,
        );
      }
      if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(nombre.trim())) {
        throw new BadRequestException(
          `El nombre de cabecera "${nombre}" no es válido.`,
        );
      }
      if (/[\r\n]/.test(valor)) {
        throw new BadRequestException(
          `El valor de la cabecera "${nombre}" no puede contener saltos de línea.`,
        );
      }
      cabeceras[nombre.trim()] = valor;
    }
    if (token) {
      cabeceras['Authorization'] = `Bearer ${token}`;
    }
    const metodo = params.metodo.toUpperCase();
    let body: string | undefined;
    if (
      metodo !== 'GET' &&
      metodo !== 'DELETE' &&
      params.cuerpo !== undefined
    ) {
      cabeceras['Content-Type'] = 'application/json';
      body = JSON.stringify(params.cuerpo);
    }

    const inicio = Date.now();
    let respuesta: Response;
    try {
      respuesta = await fetch(url.toString(), {
        method: metodo,
        headers: cabeceras,
        body,
        redirect: 'manual',
      });
    } catch (e) {
      const causa = (e as Error)?.cause as { code?: string } | undefined;
      const codigo = causa?.code ? ` (${causa.code})` : '';
      throw new BadGatewayException(
        `La solicitud no pudo ejecutarse: no se logró conectar con el objetivo ${url.origin}${codigo}. ` +
          'Verifica que la aplicación principal esté en ejecución y accesible en esa URL, y que TARGET_BASE_URL apunte al sitio correcto. ' +
          'Esto es un fallo técnico de la prueba, no un resultado del escenario.',
      );
    }
    const tiempoMs = Date.now() - inicio;

    const texto = await respuesta.text();
    let cuerpoResp: unknown = null;
    if (texto) {
      try {
        cuerpoResp = JSON.parse(texto);
      } catch {
        cuerpoResp = texto;
      }
    }

    const cabecerasMostrables: Record<string, string> = { ...cabeceras };
    if (cabecerasMostrables['Authorization']) {
      cabecerasMostrables['Authorization'] = `Bearer ${enmascararToken(token)}`;
    }

    return {
      request: {
        metodo,
        url: url.toString(),
        envioToken: Boolean(token),
        origenToken: params.origenToken,
        tokenEnmascarado: enmascararToken(token),
        tokenExpiradoAlEnviar: expirado,
        cabeceras: cabecerasMostrables,
        cuerpo: params.cuerpo,
      },
      response: {
        status: respuesta.status,
        tiempoMs,
        cuerpo: cuerpoResp,
      },
    };
  }
}
