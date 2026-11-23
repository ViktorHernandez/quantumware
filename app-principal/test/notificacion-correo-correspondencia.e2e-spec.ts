import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.CORREO_WORKER_ACTIVO = 'false';

const CON_EMAIL = '00000000-0000-0000-0000-00000000ce01';
const SIN_EMAIL_LOCAL = '00000000-0000-0000-0000-00000000ce02';
const SIN_EMAIL_NINGUNO = '00000000-0000-0000-0000-00000000ce03';
const ADMIN_A = '00000000-0000-0000-0000-00000000cea1';
const ADMIN_B = '00000000-0000-0000-0000-00000000cea2';

const TODOS = [CON_EMAIL, SIN_EMAIL_LOCAL, SIN_EMAIL_NINGUNO, ADMIN_A, ADMIN_B];

describe('Correspondencia notificación interna -> correo (sin envíos reales)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let notificaciones: NotificacionesService;

  async function limpiar() {
    await db.query(
      `DELETE FROM correo_salida WHERE notificacion_id IN
         (SELECT id FROM notificacion WHERE tipo LIKE 'zz_corr%')`,
    );
    await db.query(`DELETE FROM notificacion WHERE tipo LIKE 'zz_corr%'`);
    await db.query(
      `DELETE FROM correo_salida WHERE notificacion_id IN
         (SELECT id FROM notificacion WHERE user_id = ANY($1::uuid[]))`,
      [TODOS],
    );
    await db.query('DELETE FROM notificacion WHERE user_id = ANY($1::uuid[])', [
      TODOS,
    ]);
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [
      TODOS,
    ]);
    await db.query(
      'DELETE FROM perfil_usuario WHERE user_id = ANY($1::uuid[])',
      [TODOS],
    );
  }

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        CorreoSalidaService,
        NotificacionesService,
        { provide: BrevoService, useValue: { configurado: () => false } },
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => true,
            usuariosPorId: () =>
              Promise.resolve(
                new Map([
                  [
                    SIN_EMAIL_LOCAL,
                    { email: 'zz-cuenta-supabase@example.test' },
                  ],
                  [ADMIN_B, { email: 'zz-admin-b@example.test' }],
                ]),
              ),
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    notificaciones = modulo.get(NotificacionesService);
    await limpiar();

    await db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, email) VALUES
         ($1,'Cliente con correo','zz-cliente@example.test'),
         ($2,'Cliente sin correo local', NULL),
         ($3,'Cliente sin correo', NULL),
         ($4,'Admin A','zz-admin-a@example.test'),
         ($5,'Admin B', NULL)`,
      TODOS,
    );
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1,'admin'), ($2,'admin')`,
      [ADMIN_A, ADMIN_B],
    );
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  async function correoDe(tipo: string, usuarios: string[] = TODOS) {
    return db.query<{
      destinatario: string;
      estado: string;
      correo_estado: string | null;
      user_id: string;
    }>(
      `SELECT c.destinatario, c.estado, n.correo_estado, n.user_id
       FROM notificacion n
       LEFT JOIN correo_salida c ON c.notificacion_id = n.id
       WHERE n.tipo = $1 AND n.user_id = ANY($2::uuid[])
       ORDER BY c.destinatario`,
      [tipo, usuarios],
    );
  }

  it('una notificación a un cliente con correo genera su correo al destinatario correcto', async () => {
    await notificaciones.crear({
      userId: CON_EMAIL,
      tipo: 'zz_corr_cliente',
      titulo: 'Pedido registrado',
      mensaje: 'Tu pedido quedó registrado.',
      datos: { pedido_id: '11111111-2222-3333-4444-555555555555' },
    });
    const r = await correoDe('zz_corr_cliente');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].destinatario).toBe('zz-cliente@example.test');
    expect(r.rows[0].estado).toBe('pendiente');
    expect(r.rows[0].correo_estado).toBe('encolado');
  });

  it('si el espejo local no tiene correo, se resuelve desde la cuenta y se persiste', async () => {
    await notificaciones.crear({
      userId: SIN_EMAIL_LOCAL,
      tipo: 'zz_corr_cuenta',
      titulo: 'Aviso de seguridad',
      mensaje: 'Inicio de sesión detectado.',
    });
    const r = await correoDe('zz_corr_cuenta');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].destinatario).toBe('zz-cuenta-supabase@example.test');
    expect(r.rows[0].correo_estado).toBe('encolado');

    const persistido = await db.query<{ email: string | null }>(
      'SELECT email FROM perfil_usuario WHERE user_id = $1',
      [SIN_EMAIL_LOCAL],
    );
    expect(persistido.rows[0].email).toBe('zz-cuenta-supabase@example.test');
  });

  it('si el destinatario no tiene correo en ninguna fuente, queda trazado y no se pierde en silencio', async () => {
    await notificaciones.crear({
      userId: SIN_EMAIL_NINGUNO,
      tipo: 'zz_corr_sin_destino',
      titulo: 'Aviso',
      mensaje: 'Sin destinatario resoluble.',
    });
    const r = await correoDe('zz_corr_sin_destino');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].destinatario).toBeNull();
    expect(r.rows[0].correo_estado).toBe('sin_destinatario');
  });

  it('una notificación administrativa llega al correo propio de cada administrador, sin dirección fija ni fugas', async () => {
    await notificaciones.crearParaAdmins({
      tipo: 'zz_corr_admins',
      titulo: 'Existencias bajas',
      mensaje: 'Un producto quedó por debajo del mínimo.',
      datos: { producto_id: '99999999-8888-7777-6666-555555555555' },
    });
    const r = await correoDe('zz_corr_admins', [ADMIN_A, ADMIN_B]);
    const porAdmin = new Map(r.rows.map((x) => [x.user_id, x.destinatario]));

    expect(porAdmin.get(ADMIN_A)).toBe('zz-admin-a@example.test');
    expect(porAdmin.get(ADMIN_B)).toBe('zz-admin-b@example.test');
    expect(new Set(porAdmin.values()).size).toBe(2);
    expect(r.rows.every((x) => x.correo_estado === 'encolado')).toBe(true);

    const noAdmins = await correoDe('zz_corr_admins', [
      CON_EMAIL,
      SIN_EMAIL_LOCAL,
      SIN_EMAIL_NINGUNO,
    ]);
    expect(noAdmins.rowCount).toBe(0);
  });

  it('no se duplica el correo de una notificación deduplicada', async () => {
    const base = {
      userId: CON_EMAIL,
      tipo: 'zz_corr_dedupe',
      titulo: 'Existencias bajas',
      mensaje: 'Primera.',
      claveDedupe: 'zz-corr:dedupe-1',
    };
    await notificaciones.crear(base);
    await notificaciones.crear({ ...base, mensaje: 'Segunda.' });
    const r = await correoDe('zz_corr_dedupe');
    expect(r.rowCount).toBe(1);
  });

  it('si la operación de negocio se revierte, no queda notificación ni correo', async () => {
    await expect(
      db.transaction(async (client) => {
        await notificaciones.crear(
          {
            userId: CON_EMAIL,
            tipo: 'zz_corr_rollback',
            titulo: 'No debe existir',
            mensaje: 'Revertida.',
          },
          client,
        );
        throw new Error('fallo de negocio simulado');
      }),
    ).rejects.toThrow('fallo de negocio simulado');
    const r = await correoDe('zz_corr_rollback');
    expect(r.rowCount).toBe(0);
  });
});
