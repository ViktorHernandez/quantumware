import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UsuarioSupabase {
  email: string | null;
  creado: string | null;
  ultimoAcceso: string | null;
}

interface RespuestaAdmin {
  users?: {
    id: string;
    email?: string;
    created_at?: string;
    last_sign_in_at?: string;
  }[];
}

@Injectable()
export class SupabaseAdminService {
  private readonly url: string;
  private readonly serviceKey: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>('SUPABASE_URL', '');
    this.serviceKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY', '');
  }

  configurado(): boolean {
    return Boolean(this.url && this.serviceKey);
  }

  async eliminarUsuario(
    sub: string,
  ): Promise<{ ok: true } | { ok: false; mensaje: string }> {
    if (!this.configurado()) {
      return {
        ok: false,
        mensaje:
          'El proveedor de identidad no está configurado en el servidor (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).',
      };
    }
    try {
      const r = await fetch(
        `${this.url}/auth/v1/admin/users/${encodeURIComponent(sub)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: this.serviceKey,
            Authorization: `Bearer ${this.serviceKey}`,
          },
        },
      );
      if (!r.ok && r.status !== 404) {
        return {
          ok: false,
          mensaje: `El proveedor de identidad respondió ${r.status} al eliminar la cuenta.`,
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        mensaje: 'No fue posible contactar al proveedor de identidad.',
      };
    }
  }

  private cabeceras(): Record<string, string> {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
    };
  }

  private noConfigurado(): { ok: false; mensaje: string } {
    return {
      ok: false,
      mensaje:
        'El proveedor de identidad no está configurado en el servidor (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).',
    };
  }

  async buscarPorEmail(
    email: string,
  ): Promise<{ sub: string; email: string } | null> {
    if (!this.configurado()) {
      return null;
    }
    const objetivo = email.trim().toLowerCase();
    try {
      const r = await fetch(`${this.url}/auth/v1/admin/users?per_page=1000`, {
        headers: this.cabeceras(),
      });
      if (!r.ok) {
        return null;
      }
      const datos = (await r.json()) as RespuestaAdmin;
      for (const u of datos.users ?? []) {
        if ((u.email ?? '').trim().toLowerCase() === objetivo) {
          return { sub: u.id, email: u.email ?? objetivo };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async actualizarContrasena(
    sub: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; mensaje: string }> {
    if (!this.configurado()) {
      return this.noConfigurado();
    }
    try {
      const r = await fetch(
        `${this.url}/auth/v1/admin/users/${encodeURIComponent(sub)}`,
        {
          method: 'PUT',
          headers: this.cabeceras(),
          body: JSON.stringify({ password, email_confirm: true }),
        },
      );
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => null)) as {
          msg?: string;
          message?: string;
          error_description?: string;
        } | null;
        return {
          ok: false,
          mensaje:
            cuerpo?.msg ??
            cuerpo?.message ??
            cuerpo?.error_description ??
            `El proveedor de identidad respondió ${r.status}.`,
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        mensaje: 'No fue posible contactar al proveedor de identidad.',
      };
    }
  }

  async crearConContrasena(
    email: string,
    password: string,
  ): Promise<{ ok: true; sub: string } | { ok: false; mensaje: string }> {
    if (!this.configurado()) {
      return this.noConfigurado();
    }
    try {
      const r = await fetch(`${this.url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: this.cabeceras(),
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const cuerpo = (await r.json().catch(() => null)) as {
        id?: string;
        msg?: string;
        message?: string;
        error_description?: string;
      } | null;
      if (!r.ok || !cuerpo?.id) {
        return {
          ok: false,
          mensaje:
            cuerpo?.msg ??
            cuerpo?.message ??
            cuerpo?.error_description ??
            `El proveedor de identidad respondió ${r.status}.`,
        };
      }
      return { ok: true, sub: cuerpo.id };
    } catch {
      return {
        ok: false,
        mensaje: 'No fue posible contactar al proveedor de identidad.',
      };
    }
  }

  async usuariosPorId(): Promise<Map<string, UsuarioSupabase>> {
    const mapa = new Map<string, UsuarioSupabase>();
    if (!this.configurado()) {
      return mapa;
    }
    try {
      const r = await fetch(`${this.url}/auth/v1/admin/users?per_page=1000`, {
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${this.serviceKey}`,
        },
      });
      if (!r.ok) {
        return mapa;
      }
      const datos = (await r.json()) as RespuestaAdmin;
      for (const u of datos.users ?? []) {
        mapa.set(u.id, {
          email: u.email ?? null,
          creado: u.created_at ?? null,
          ultimoAcceso: u.last_sign_in_at ?? null,
        });
      }
    } catch {
      return mapa;
    }
    return mapa;
  }
}
