import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enmascararToken } from './enmascarar';

interface TokenCapturado {
  token: string;
  email: string;
  capturadoEn: string;
  expiraEn: string | null;
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
  ): Promise<{ email: string; capturadoEn: string; expiraEn: string | null }> {
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
    const exp = expDeToken(data.session.access_token);
    const capturado: TokenCapturado = {
      token: data.session.access_token,
      email,
      capturadoEn: new Date().toISOString(),
      expiraEn: exp ? new Date(exp * 1000).toISOString() : null,
    };
    this.almacen.set(rol, capturado);
    return {
      email,
      capturadoEn: capturado.capturadoEn,
      expiraEn: capturado.expiraEn,
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
        tokenEnmascarado: enmascararToken(v.token),
      };
    }
    return salida;
  }
}
