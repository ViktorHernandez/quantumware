import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export type TipoToken = 'invitacion' | 'recuperacion';

export interface TokenEmitido {
  id: string;
  token: string;
  expiraEn: Date;
}

export interface TokenVigente {
  id: string;
  tipo: TipoToken;
  email: string;
  usuarioSub: string | null;
  rol: string | null;
  invitacionId: string | null;
}

export type MotivoInvalido =
  'formato' | 'inexistente' | 'expirado' | 'usado' | 'anulado';

interface Consultor {
  query: DatabaseService['query'];
}

const LONGITUD_BYTES = 32;
const PATRON_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function hashDe(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class CredencialTokenService {
  constructor(private readonly db: DatabaseService) {}

  private comparar(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  }

  async emitir(
    datos: {
      tipo: TipoToken;
      email: string;
      usuarioSub?: string | null;
      rol?: string | null;
      invitacionId?: string | null;
      minutosVigencia: number;
    },
    cliente?: PoolClient,
  ): Promise<TokenEmitido> {
    const c: Consultor = cliente ?? this.db;
    const token = randomBytes(LONGITUD_BYTES).toString('base64url');
    const r = await c.query<{ id: string; expira_en: Date }>(
      `INSERT INTO credencial_token
         (tipo, token_hash, email, usuario_sub, rol, invitacion_id, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' minutes')::interval)
       RETURNING id, expira_en`,
      [
        datos.tipo,
        hashDe(token),
        datos.email.toLowerCase(),
        datos.usuarioSub ?? null,
        datos.rol ?? null,
        datos.invitacionId ?? null,
        String(Math.max(1, Math.trunc(datos.minutosVigencia))),
      ],
    );
    return { id: r.rows[0].id, token, expiraEn: r.rows[0].expira_en };
  }

  async anularVigentes(
    tipo: TipoToken,
    email: string,
    cliente?: PoolClient,
  ): Promise<number> {
    const c: Consultor = cliente ?? this.db;
    const r = await c.query(
      `UPDATE credencial_token SET anulado_en = now()
       WHERE tipo = $1 AND lower(email) = $2
         AND usado_en IS NULL AND anulado_en IS NULL`,
      [tipo, email.toLowerCase()],
    );
    return r.rowCount ?? 0;
  }

  async emitidosDesde(
    tipo: TipoToken,
    email: string,
    minutos: number,
  ): Promise<number> {
    const r = await this.db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM credencial_token
       WHERE tipo = $1 AND lower(email) = $2
         AND creado_en > now() - ($3 || ' minutes')::interval`,
      [tipo, email.toLowerCase(), String(Math.max(1, Math.trunc(minutos)))],
    );
    return Number(r.rows[0].n);
  }

  async inspeccionar(
    token: string,
  ): Promise<
    | { valido: true; datos: TokenVigente }
    | { valido: false; motivo: MotivoInvalido }
  > {
    if (!PATRON_TOKEN.test(token)) {
      return { valido: false, motivo: 'formato' };
    }
    const r = await this.db.query<{
      id: string;
      tipo: TipoToken;
      token_hash: string;
      email: string;
      usuario_sub: string | null;
      rol: string | null;
      invitacion_id: string | null;
      expirado: boolean;
      usado: boolean;
      anulado: boolean;
    }>(
      `SELECT id, tipo, token_hash, email, usuario_sub, rol, invitacion_id,
              (expira_en <= now()) AS expirado,
              (usado_en IS NOT NULL) AS usado,
              (anulado_en IS NOT NULL) AS anulado
       FROM credencial_token WHERE token_hash = $1`,
      [hashDe(token)],
    );
    const fila = r.rows[0];
    if (!fila || !this.comparar(fila.token_hash, hashDe(token))) {
      return { valido: false, motivo: 'inexistente' };
    }
    if (fila.usado) {
      return { valido: false, motivo: 'usado' };
    }
    if (fila.anulado) {
      return { valido: false, motivo: 'anulado' };
    }
    if (fila.expirado) {
      return { valido: false, motivo: 'expirado' };
    }
    return {
      valido: true,
      datos: {
        id: fila.id,
        tipo: fila.tipo,
        email: fila.email,
        usuarioSub: fila.usuario_sub,
        rol: fila.rol,
        invitacionId: fila.invitacion_id,
      },
    };
  }

  async consumir(
    token: string,
    cliente: PoolClient,
  ): Promise<
    | { valido: true; datos: TokenVigente }
    | { valido: false; motivo: MotivoInvalido }
  > {
    if (!PATRON_TOKEN.test(token)) {
      return { valido: false, motivo: 'formato' };
    }
    const r = await cliente.query<{
      id: string;
      tipo: TipoToken;
      email: string;
      usuario_sub: string | null;
      rol: string | null;
      invitacion_id: string | null;
    }>(
      `UPDATE credencial_token SET usado_en = now()
       WHERE token_hash = $1
         AND usado_en IS NULL AND anulado_en IS NULL AND expira_en > now()
       RETURNING id, tipo, email, usuario_sub, rol, invitacion_id`,
      [hashDe(token)],
    );
    if (r.rowCount === 0) {
      const estado = await this.inspeccionar(token);
      return estado.valido
        ? { valido: false, motivo: 'inexistente' }
        : { valido: false, motivo: estado.motivo };
    }
    const fila = r.rows[0];
    return {
      valido: true,
      datos: {
        id: fila.id,
        tipo: fila.tipo,
        email: fila.email,
        usuarioSub: fila.usuario_sub,
        rol: fila.rol,
        invitacionId: fila.invitacion_id,
      },
    };
  }
}
