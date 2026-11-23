import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enmascararToken } from './enmascarar';

interface TokenCapturado {
  token: string;
  email: string;
  capturadoEn: string;
  expiraEn: string | null;
  aal: string | null;
}

export const RANURA_EXPIRADO = 'expirado';

function payloadDeToken(token: string): Record<string, unknown> | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }
  try {
    const normalizado = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno =
      normalizado + '='.repeat((4 - (normalizado.length % 4)) % 4);
    const payload: unknown = JSON.parse(
      Buffer.from(relleno, 'base64').toString('utf8'),
    );
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function aalDeToken(token: string): string | null {
  const payload = payloadDeToken(token);
  const aal = payload?.aal;
  return typeof aal === 'string' ? aal : null;
}

function expDeToken(token: string): number | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }
  try {
    const normalizado = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const relleno =
      normalizado + '='.repeat((4 - (normalizado.length % 4)) % 4);
    const payload: unknown = JSON.parse(
      Buffer.from(relleno, 'base64').toString('utf8'),
    );
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

@Injectable()
export class SesionService {
  private readonly almacen = new Map<string, TokenCapturado>();
  private cliente: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  configurado(): boolean {
    return Boolean(
      this.config.get<string>('SUPABASE_URL') &&
      this.config.get<string>('SUPABASE_PUBLISHABLE_KEY'),
    );
  }

  private obtenerCliente(): SupabaseClient {
    if (!this.cliente) {
      this.cliente = createClient(
        this.config.get<string>('SUPABASE_URL', ''),
        this.config.get<string>('SUPABASE_PUBLISHABLE_KEY', ''),
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
    }
    return this.cliente;
  }

  private credenciales(rol: string): { email: string; password: string } {
    if (rol === 'admin') {
      return {
        email: this.config.get<string>('TEST_ADMIN_EMAIL', ''),
        password: this.config.get<string>('TEST_ADMIN_PASSWORD', ''),
      };
    }
    return {
      email: this.config.get<string>('TEST_CLIENT_EMAIL', ''),
      password: this.config.get<string>('TEST_CLIENT_PASSWORD', ''),
    };
  }

  async iniciar(
    rol: string,
    codigoMfa?: string,
  ): Promise<{
    email: string;
    capturadoEn: string;
    expiraEn: string | null;
    aal: string | null;
    mfaPendiente: boolean;
  }> {
    if (!this.configurado()) {
      throw new Error(
        'Supabase no está configurado. Define SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en cliente-atacante/.env',
      );
    }
    const { email, password } = this.credenciales(rol);
    if (!email || !password) {
      throw new Error(
        `Faltan credenciales de prueba para el rol ${rol} en cliente-atacante/.env`,
      );
    }
    const { data, error } = await this.obtenerCliente().auth.signInWithPassword(
      {
        email,
        password,
      },
    );
    if (error) {
      const codigo = error.code ? ` [${error.code}]` : '';
      throw new Error(
        `No fue posible iniciar sesión como ${rol}: ${error.message}${codigo}. Revisa TEST_${rol === 'admin' ? 'ADMIN' : 'CLIENT'}_EMAIL y TEST_${rol === 'admin' ? 'ADMIN' : 'CLIENT'}_PASSWORD en cliente-atacante/.env y que la cuenta exista y esté confirmada en Supabase.`,
      );
    }
    if (!data.session) {
      throw new Error(
        `Supabase aceptó las credenciales de ${rol} pero no devolvió una sesión (posible cuenta sin confirmar o verificación adicional pendiente).`,
      );
    }
    let accessToken = data.session.access_token;
    let mfaPendiente = false;

    const nivel = await this.obtenerCliente()
      .auth.mfa.getAuthenticatorAssuranceLevel()
      .catch(() => null);
    const requiereSegundoFactor =
      nivel?.data?.nextLevel === 'aal2' &&
      nivel.data.nextLevel !== nivel.data.currentLevel;

    if (requiereSegundoFactor) {
      if (!codigoMfa) {
        mfaPendiente = true;
      } else {
        accessToken = await this.completarSegundoFactor(codigoMfa);
      }
    }

    const exp = expDeToken(accessToken);
    const capturado: TokenCapturado = {
      token: accessToken,
      email,
      capturadoEn: new Date().toISOString(),
      expiraEn: exp ? new Date(exp * 1000).toISOString() : null,
      aal: aalDeToken(accessToken),
    };
    this.almacen.set(rol, capturado);
    return {
      email,
      capturadoEn: capturado.capturadoEn,
      expiraEn: capturado.expiraEn,
      aal: capturado.aal,
      mfaPendiente,
    };
  }

  private async completarSegundoFactor(codigo: string): Promise<string> {
    const cliente = this.obtenerCliente();
    const factores = await cliente.auth.mfa.listFactors();
    if (factores.error) {
      throw new Error(
        `No fue posible consultar los factores de verificación en dos pasos: ${factores.error.message}`,
      );
    }
    const totp = (factores.data?.totp ?? []).find(
      (f) => f.status === 'verified',
    );
    if (!totp) {
      throw new Error(
        'La cuenta no tiene un factor TOTP verificado, por lo que no procede enviar un código.',
      );
    }
    const reto = await cliente.auth.mfa.challenge({ factorId: totp.id });
    if (reto.error || !reto.data) {
      throw new Error(
        `No fue posible iniciar el reto de verificación en dos pasos: ${reto.error?.message ?? 'respuesta vacía'}`,
      );
    }
    const verificado = await cliente.auth.mfa.verify({
      factorId: totp.id,
      challengeId: reto.data.id,
      code: codigo,
    });
    if (verificado.error || !verificado.data?.access_token) {
      throw new Error(
        `El código de verificación en dos pasos no fue aceptado: ${verificado.error?.message ?? 'respuesta vacía'}`,
      );
    }
    return verificado.data.access_token;
  }

  async asegurarCliente(): Promise<void> {
    if (!this.almacen.get('cliente')) {
      await this.iniciar('cliente');
    }
  }

  subDe(rol: string): string | null {
    const token = this.almacen.get(rol)?.token;
    if (!token) {
      return null;
    }
    const payload = payloadDeToken(token);
    const sub = payload?.sub;
    return typeof sub === 'string' ? sub : null;
  }

  guardarTokenExpirado(token: string): {
    expiraEn: string | null;
    expEpoch: number | null;
    expirado: boolean;
  } {
    const exp = expDeToken(token);
    this.almacen.set(RANURA_EXPIRADO, {
      token,
      email: 'token-laboratorio',
      capturadoEn: new Date().toISOString(),
      expiraEn: exp ? new Date(exp * 1000).toISOString() : null,
      aal: aalDeToken(token),
    });
    return {
      expiraEn: exp ? new Date(exp * 1000).toISOString() : null,
      expEpoch: exp,
      expirado: exp ? exp * 1000 < Date.now() : false,
    };
  }

  cerrar(rol: string): void {
    this.almacen.delete(rol);
  }

  token(rol: string): string | null {
    return this.almacen.get(rol)?.token ?? null;
  }

  estado(): Record<
    string,
    {
      email: string;
      capturadoEn: string;
      expiraEn: string | null;
      expirado: boolean;
      aal: string | null;
      tokenEnmascarado: string | null;
    }
  > {
    const salida: Record<
      string,
      {
        email: string;
        capturadoEn: string;
        expiraEn: string | null;
        expirado: boolean;
        aal: string | null;
        tokenEnmascarado: string | null;
      }
    > = {};
    for (const [rol, v] of this.almacen.entries()) {
      salida[rol] = {
        email: v.email,
        capturadoEn: v.capturadoEn,
        expiraEn: v.expiraEn,
        expirado: v.expiraEn
          ? new Date(v.expiraEn).getTime() < Date.now()
          : false,
        aal: v.aal,
        tokenEnmascarado: enmascararToken(v.token),
      };
    }
    return salida;
  }
}
