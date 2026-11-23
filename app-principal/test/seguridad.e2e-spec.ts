import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { SeguridadService } from '../src/seguridad/seguridad.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.CORREO_WORKER_ACTIVO = 'false';

const USUARIO = '00000000-0000-0000-0000-00000000edd1';

describe('Notificaciones de seguridad de inicio de sesión', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let seguridad: SeguridadService;

  async function limpiar() {
    await db.query(
      `DELETE FROM correo_salida WHERE destinatario = 'zz-seguridad@example.test'`,
    );
    await db.query('DELETE FROM notificacion WHERE user_id = $1', [USUARIO]);
    await db.query('DELETE FROM perfil_usuario WHERE user_id = $1', [USUARIO]);
  }

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => false,
            usuariosPorId: () =>
              Promise.resolve(new Map<string, { email: string | null }>()),
          },
        },
        DatabaseService,
        CorreoSalidaService,
        NotificacionesService,
        SeguridadService,
        {
          provide: BrevoService,
          useValue: {
            configurado: () => false,
            enviar: () => Promise.resolve(false),
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    seguridad = modulo.get(SeguridadService);
    await limpiar();
    await db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, email)
       VALUES ($1, 'Usuario Seguridad', 'zz-seguridad@example.test')`,
      [USUARIO],
    );
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  it('un inicio de sesión genera notificación de seguridad y correo, sin exponer secretos', async () => {
    const momento = new Date('2026-11-14T10:00:00Z');
    await seguridad.registrarInicioSesion(USUARIO, {
      agente: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      aal: 'aal2',
      momento,
    });
    const notis = await db.query<{
      tipo: string;
      mensaje: string;
      datos: Record<string, unknown>;
    }>(
      `SELECT tipo, mensaje, datos FROM notificacion
       WHERE user_id = $1 AND tipo = 'seguridad_inicio_sesion'`,
      [USUARIO],
    );
    expect(notis.rowCount).toBe(1);
    expect(notis.rows[0].datos).not.toHaveProperty('token');
    expect(JSON.stringify(notis.rows[0])).not.toContain('eyJ');

    const correos = await db.query<{ estado: string; asunto: string }>(
      `SELECT c.estado, c.asunto FROM correo_salida c
       JOIN notificacion n ON n.id = c.notificacion_id
       WHERE n.user_id = $1 AND n.tipo = 'seguridad_inicio_sesion'`,
      [USUARIO],
    );
    expect(correos.rowCount).toBe(1);
    expect(correos.rows[0].estado).toBe('pendiente');
    expect(correos.rows[0].asunto).toContain('inicio de sesión');
  });

  it('los inicios repetidos dentro de la ventana se agrupan y no duplican correos', async () => {
    const base = new Date('2026-11-14T10:00:00Z');
    await seguridad.registrarInicioSesion(USUARIO, {
      momento: new Date(base.getTime() + 2 * 60 * 1000),
    });
    await seguridad.registrarInicioSesion(USUARIO, {
      momento: new Date(base.getTime() + 5 * 60 * 1000),
    });
    const notis = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notificacion
       WHERE user_id = $1 AND tipo = 'seguridad_inicio_sesion'`,
      [USUARIO],
    );
    expect(Number(notis.rows[0].n)).toBe(1);
  });

  it('un inicio en una ventana distinta sí genera un aviso nuevo', async () => {
    await seguridad.registrarInicioSesion(USUARIO, {
      momento: new Date('2026-11-14T11:30:00Z'),
    });
    const notis = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notificacion
       WHERE user_id = $1 AND tipo = 'seguridad_inicio_sesion'`,
      [USUARIO],
    );
    expect(Number(notis.rows[0].n)).toBe(2);
  });
});
