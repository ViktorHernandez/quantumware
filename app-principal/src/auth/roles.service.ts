import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  private adminsAutorizados(): string[] {
    return this.config
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((correo) => correo.trim().toLowerCase())
      .filter((correo) => correo.length > 0);
  }

  async rolDe(sub: string): Promise<string | null> {
    const r = await this.db.query<{ rol: string }>(
      'SELECT rol FROM user_roles WHERE user_id = $1',
      [sub],
    );
    return r.rows[0]?.rol ?? null;
  }

  async esAdmin(sub: string): Promise<boolean> {
    return (await this.rolDe(sub)) === 'admin';
  }

  async asegurarRol(sub: string, email?: string): Promise<string> {
    const actual = await this.rolDe(sub);
    const correo = (email ?? '').trim().toLowerCase();
    const esAdminAutorizado =
      correo.length > 0 && this.adminsAutorizados().includes(correo);

    if (esAdminAutorizado) {
      if (actual !== 'admin') {
        await this.db.query(
          `INSERT INTO user_roles (user_id, rol) VALUES ($1, 'admin')
           ON CONFLICT (user_id) DO UPDATE SET rol = 'admin'`,
          [sub],
        );
      }
      return 'admin';
    }

    if (!actual) {
      await this.db.query(
        `INSERT INTO user_roles (user_id, rol) VALUES ($1, 'cliente')
         ON CONFLICT (user_id) DO NOTHING`,
        [sub],
      );
      return 'cliente';
    }

    return actual;
  }
}
