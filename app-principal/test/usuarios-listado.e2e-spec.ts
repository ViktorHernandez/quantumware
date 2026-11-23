import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { CredencialTokenService } from '../src/cuenta/credencial-token.service';
import { CuentaService } from '../src/cuenta/cuenta.service';
import { UsuariosService } from '../src/usuarios/usuarios.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const U_ADMIN = '00000000-0000-0000-0000-00000000d001';
const U_CLIENTE = '00000000-0000-0000-0000-00000000d002';
const U_SINROL = '00000000-0000-0000-0000-00000000d003';
const IDS = [U_ADMIN, U_CLIENTE, U_SINROL];

describe('Listado de usuarios (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let usuarios: UsuariosService;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        NotificacionesService,
        BrevoService,
        CorreoSalidaService,
        SupabaseAdminService,
        UsuariosService,
        CredencialTokenService,
        CuentaService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    usuarios = modulo.get(UsuariosService);
    await limpiar();
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1,'admin'), ($2,'cliente')`,
      [U_ADMIN, U_CLIENTE],
    );
    await db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, email) VALUES ($1,$2,$3)`,
      [U_ADMIN, 'Admin Prueba', 'admin.zz@prueba.local'],
    );
    await db.query(
      `INSERT INTO perfil_usuario (user_id, email) VALUES ($1,$2)`,
      [U_SINROL, 'sinrol.zz@prueba.local'],
    );
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  async function limpiar() {
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [
      IDS,
    ]);
    await db.query(
      'DELETE FROM perfil_usuario WHERE user_id = ANY($1::uuid[])',
      [IDS],
    );
  }

  it('incluye usuarios con rol sin perfil y con perfil sin rol, con estados legibles', async () => {
    const r = await usuarios.listar();
    const porId = new Map(r.items.map((u) => [u.user_id, u]));

    expect(porId.get(U_ADMIN)?.nombre).toBe('Admin Prueba');
    expect(porId.get(U_ADMIN)?.rol).toBe('admin');

    const cliente = porId.get(U_CLIENTE);
    expect(cliente?.rol).toBe('cliente');
    expect(cliente?.nombre).toBeNull();
    expect(cliente?.estado).toBe('activo');

    const sinRol = porId.get(U_SINROL);
    expect(sinRol?.rol).toBeNull();
    expect(sinRol?.estado).toBe('sin rol asignado');
    expect(sinRol?.email).toBe('sinrol.zz@prueba.local');

    expect(r.adminConfigurado).toBe(false);
  });

  it('filtra por rol sin_rol y busca por texto', async () => {
    const sinRol = await usuarios.listar({ rol: 'sin_rol' });
    expect(sinRol.items.some((u) => u.user_id === U_SINROL)).toBe(true);
    expect(sinRol.items.some((u) => u.user_id === U_ADMIN)).toBe(false);

    const busqueda = await usuarios.listar({ q: 'Admin Prueba' });
    expect(busqueda.items.some((u) => u.user_id === U_ADMIN)).toBe(true);
  });
});
