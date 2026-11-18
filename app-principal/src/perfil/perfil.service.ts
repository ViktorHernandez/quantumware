import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RolesService } from '../auth/roles.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';

interface FilaPerfil {
  nombre: string | null;
  telefono: string | null;
  email: string | null;
}

@Injectable()
export class PerfilService {
  constructor(
    private readonly db: DatabaseService,
    private readonly roles: RolesService,
    private readonly usuarios: UsuariosService,
  ) {}

  private async sincronizar(sub: string, email?: string): Promise<void> {
    await this.db.query(
      `INSERT INTO perfil_usuario (user_id, email)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
         SET email = COALESCE(EXCLUDED.email, perfil_usuario.email)`,
      [sub, email ?? null],
    );
  }

  async obtener(sub: string, email?: string) {
    await this.sincronizar(sub, email);
    if (email) {
      await this.usuarios.aplicarInvitacion(sub, email);
    }
    const rol = await this.roles.asegurarRol(sub, email);
    const r = await this.db.query<FilaPerfil>(
      'SELECT nombre, telefono, email FROM perfil_usuario WHERE user_id = $1',
      [sub],
    );
    const perfil = r.rows[0] ?? { nombre: null, telefono: null, email: null };
    return {
      sub,
      email: email ?? perfil.email,
      rol,
      nombre: perfil.nombre,
      telefono: perfil.telefono,
      sinRolAsignado: rol === null,
    };
  }

  async actualizar(sub: string, dto: ActualizarPerfilDto, email?: string) {
    await this.db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, telefono, email, actualizado)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
         SET nombre = COALESCE(EXCLUDED.nombre, perfil_usuario.nombre),
             telefono = COALESCE(EXCLUDED.telefono, perfil_usuario.telefono),
             email = COALESCE(EXCLUDED.email, perfil_usuario.email),
             actualizado = now()`,
      [sub, dto.nombre ?? null, dto.telefono ?? null, email ?? null],
    );
    return this.obtener(sub, email);
  }
}
