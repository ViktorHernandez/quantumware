import { ConfigModule } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { CredencialTokenService } from '../src/cuenta/credencial-token.service';
import { CuentaService } from '../src/cuenta/cuenta.service';
import { UsuariosService } from '../src/usuarios/usuarios.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.CORREO_WORKER_ACTIVO = 'false';

const ADMIN = '00000000-0000-0000-0000-00000000ee01';
const ADMIN_DOS = '00000000-0000-0000-0000-00000000ee02';
const INVITADO = '00000000-0000-0000-0000-00000000ee10';
const EMAIL_INVITADO = 'zz-inv-invitado@example.test';

describe('Invitaciones de un solo uso y eliminación de cuentas', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let usuarios: UsuariosService;
  const eliminadosEnProveedor: string[] = [];

  async function limpiar() {
    await db.query(
      `DELETE FROM credencial_token WHERE lower(email) LIKE 'zz-inv-%'`,
    );
    await db.query(`DELETE FROM invitacion WHERE lower(email) LIKE 'zz-inv-%'`);
    await db.query(
      `DELETE FROM correo_salida WHERE lower(destinatario) LIKE 'zz-inv-%'`,
    );
    await db.query('DELETE FROM notificacion WHERE user_id = ANY($1::uuid[])', [
      [ADMIN, ADMIN_DOS, INVITADO],
    ]);
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [
      [ADMIN, ADMIN_DOS, INVITADO],
    ]);
    await db.query(
      'DELETE FROM perfil_usuario WHERE user_id = ANY($1::uuid[])',
      [[ADMIN, ADMIN_DOS, INVITADO]],
    );
  }

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        CorreoSalidaService,
        NotificacionesService,
        UsuariosService,
        CredencialTokenService,
        CuentaService,
        {
          provide: BrevoService,
          useValue: {
            configurado: () => false,
            enviar: () => Promise.resolve(false),
          },
        },
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => true,
            usuariosPorId: () =>
              Promise.resolve(new Map<string, { email: string | null }>()),
            invitar: () => Promise.resolve({ ok: true, sub: INVITADO }),
            eliminarUsuario: (sub: string) => {
              eliminadosEnProveedor.push(sub);
              return Promise.resolve({ ok: true });
            },
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    usuarios = modulo.get(UsuariosService);
    await limpiar();
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1, 'admin'), ($2, 'admin')`,
      [ADMIN, ADMIN_DOS],
    );
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  it('una invitación se registra como pendiente, con rol y expiración', async () => {
    const r = await usuarios.invitar(
      { email: EMAIL_INVITADO, rol: 'cliente' },
      ADMIN,
    );
    expect(r.estado).toBe('pendiente');
    expect(r.rol).toBe('cliente');
    expect(new Date(r.expira_en).getTime()).toBeGreaterThan(Date.now());
  });

  it('no se permite una segunda invitación pendiente para el mismo correo', async () => {
    await expect(
      usuarios.invitar({ email: EMAIL_INVITADO, rol: 'admin' }, ADMIN),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('al autenticarse, la invitación se acepta una sola vez y el rol se asigna en el servidor', async () => {
    const rol = await usuarios.aplicarInvitacion(INVITADO, EMAIL_INVITADO);
    expect(rol).toBe('cliente');
    const fila = await db.query<{ estado: string; usuario_sub: string }>(
      `SELECT estado, usuario_sub FROM invitacion WHERE lower(email) = $1`,
      [EMAIL_INVITADO],
    );
    expect(fila.rows[0].estado).toBe('aceptada');
    expect(fila.rows[0].usuario_sub).toBe(INVITADO);

    const segunda = await usuarios.aplicarInvitacion(INVITADO, EMAIL_INVITADO);
    expect(segunda).toBeNull();
  });

  it('una invitación expirada no asigna rol y queda marcada como expirada', async () => {
    await db.query(
      `INSERT INTO invitacion (email, rol, creada_por, expira_en)
       VALUES ('zz-inv-expirada@example.test', 'admin', $1, now() - interval '1 hour')`,
      [ADMIN],
    );
    const rol = await usuarios.aplicarInvitacion(
      '00000000-0000-0000-0000-00000000ee99',
      'zz-inv-expirada@example.test',
    );
    expect(rol).toBeNull();
    const fila = await db.query<{ estado: string }>(
      `SELECT estado FROM invitacion WHERE email = 'zz-inv-expirada@example.test'`,
    );
    expect(fila.rows[0].estado).toBe('expirada');
  });

  it('revocar una invitación pendiente anula su enlace y no admite revocarla dos veces', async () => {
    const creada = await usuarios.invitar(
      { email: 'zz-inv-revocar@example.test', rol: 'cliente' },
      ADMIN,
    );
    const vigentes = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM credencial_token
       WHERE lower(email) = 'zz-inv-revocar@example.test'
         AND usado_en IS NULL AND anulado_en IS NULL`,
    );
    expect(Number(vigentes.rows[0].n)).toBe(1);

    const r = await usuarios.revocarInvitacion(creada.id);
    expect(r.estado).toBe('revocada');

    const anulados = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM credencial_token
       WHERE lower(email) = 'zz-inv-revocar@example.test'
         AND anulado_en IS NOT NULL`,
    );
    expect(Number(anulados.rows[0].n)).toBe(1);

    await expect(usuarios.revocarInvitacion(creada.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('eliminar una cuenta limpia datos personales, conserva auditoría y bloquea autoeliminación', async () => {
    await db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, email)
       VALUES ($1, 'Invitado Prueba', $2)`,
      [INVITADO, EMAIL_INVITADO],
    );
    await db.query(
      `INSERT INTO notificacion (user_id, tipo, titulo, mensaje)
       VALUES ($1, 'prueba', 'x', 'y')`,
      [INVITADO],
    );
    await expect(usuarios.eliminarCuenta(ADMIN, ADMIN)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    eliminadosEnProveedor.length = 0;
    const r = await usuarios.eliminarCuenta(INVITADO, ADMIN);
    expect(r.eliminada).toBe(true);
    expect(eliminadosEnProveedor).toContain(INVITADO);
    const restos = await db.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM user_roles WHERE user_id = $1) +
              (SELECT count(*) FROM perfil_usuario WHERE user_id = $1) +
              (SELECT count(*) FROM notificacion WHERE user_id = $1) AS n`,
      [INVITADO],
    );
    expect(Number(restos.rows[0].n)).toBe(0);
  });

  it('una cuenta de administrador puede eliminarse mientras quede otro administrador', async () => {
    await db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, email)
       VALUES ($1, 'Admin Secundario', 'zz-inv-admin2@example.test')`,
      [ADMIN_DOS],
    );
    const r = await usuarios.eliminarCuenta(ADMIN_DOS, ADMIN);
    expect(r.eliminada).toBe(true);
    const queda = await db.query<{ rol: string }>(
      'SELECT rol FROM user_roles WHERE user_id = $1',
      [ADMIN],
    );
    expect(queda.rows[0].rol).toBe('admin');
  });
});
