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

const CLIENTE = '00000000-0000-0000-0000-00000000c0c1';
const ADMIN_UNO = '00000000-0000-0000-0000-00000000c0a1';
const ADMIN_DOS = '00000000-0000-0000-0000-00000000c0a2';

describe('Outbox transaccional de correo (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let outbox: CorreoSalidaService;
  let notificaciones: NotificacionesService;
  let brevoConfigurado = true;
  const envios: Array<{ para: string; asunto: string }> = [];
  let resultadoEnvio = true;

  async function limpiar() {
    await db.query(
      `DELETE FROM correo_salida
       WHERE notificacion_id IN (
         SELECT id FROM notificacion
         WHERE tipo = 'prueba_admins'
           AND titulo = 'Evento administrativo'
           AND mensaje = 'Solo para administración.'
       )`,
    );
    await db.query(
      `DELETE FROM notificacion
       WHERE tipo = 'prueba_admins'
         AND titulo = 'Evento administrativo'
         AND mensaje = 'Solo para administración.'`,
    );
    await db.query(
      `DELETE FROM correo_salida WHERE destinatario LIKE 'zz-prueba-%'`,
    );
    await db.query('DELETE FROM notificacion WHERE user_id = ANY($1::uuid[])', [
      [CLIENTE, ADMIN_UNO, ADMIN_DOS],
    ]);
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [
      [ADMIN_UNO, ADMIN_DOS, CLIENTE],
    ]);
    await db.query(
      'DELETE FROM perfil_usuario WHERE user_id = ANY($1::uuid[])',
      [[CLIENTE, ADMIN_UNO, ADMIN_DOS]],
    );
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
        {
          provide: BrevoService,
          useValue: {
            configurado: () => brevoConfigurado,
            enviar: (correo: { para: string; asunto: string }) => {
              envios.push({ para: correo.para, asunto: correo.asunto });
              return Promise.resolve(resultadoEnvio);
            },
            enviarDetallado: (correo: { para: string; asunto: string }) => {
              envios.push({ para: correo.para, asunto: correo.asunto });
              return Promise.resolve({
                enviado: resultadoEnvio,
                permanente: false,
                detalle: resultadoEnvio
                  ? undefined
                  : 'El proveedor de correo no aceptó el envío.',
              });
            },
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    outbox = modulo.get(CorreoSalidaService);
    notificaciones = modulo.get(NotificacionesService);
    await limpiar();

    await db.query(
      `INSERT INTO perfil_usuario (user_id, nombre, email) VALUES
         ($1, 'Cliente Prueba', 'zz-prueba-cliente@example.test'),
         ($2, 'Admin Uno', 'zz-prueba-admin1@example.test'),
         ($3, 'Admin Dos', NULL)`,
      [CLIENTE, ADMIN_UNO, ADMIN_DOS],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES
         ($1, 'cliente'), ($2, 'admin'), ($3, 'admin')`,
      [CLIENTE, ADMIN_UNO, ADMIN_DOS],
    );
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  beforeEach(() => {
    envios.length = 0;
    resultadoEnvio = true;
    brevoConfigurado = true;
  });

  it('encolar es idempotente por clave de deduplicación', async () => {
    const correo = {
      destinatario: 'zz-prueba-cliente@example.test',
      asunto: 'Prueba idempotencia',
      html: '<p>hola</p>',
      claveDedupe: 'zz-prueba:idem-1',
    };
    const primero = await outbox.encolar(correo);
    const segundo = await outbox.encolar(correo);
    expect(primero).toBe(true);
    expect(segundo).toBe(false);
    const r = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM correo_salida WHERE clave_dedupe = 'zz-prueba:idem-1'`,
    );
    expect(Number(r.rows[0].n)).toBe(1);
  });

  it('un correo encolado queda pendiente y solo se marca enviado cuando el proveedor acepta', async () => {
    await outbox.encolar({
      destinatario: 'zz-prueba-cliente@example.test',
      asunto: 'Prueba envío',
      html: '<p>contenido</p>',
      claveDedupe: 'zz-prueba:envio-1',
    });
    const antes = await db.query<{ estado: string }>(
      `SELECT estado FROM correo_salida WHERE clave_dedupe = 'zz-prueba:envio-1'`,
    );
    expect(antes.rows[0].estado).toBe('pendiente');

    const objetivo = await db.query<{ id: string }>(
      `SELECT id FROM correo_salida WHERE clave_dedupe = 'zz-prueba:envio-1'`,
    );
    const resultado = await outbox.procesarPendientes(10, [
      objetivo.rows[0].id,
    ]);
    expect(resultado.enviados).toBe(1);
    const despues = await db.query<{
      estado: string;
      enviado_en: string | null;
    }>(
      `SELECT estado, enviado_en FROM correo_salida WHERE clave_dedupe = 'zz-prueba:envio-1'`,
    );
    expect(despues.rows[0].estado).toBe('enviado');
    expect(despues.rows[0].enviado_en).not.toBeNull();
    expect(
      envios.some((e) => e.para === 'zz-prueba-cliente@example.test'),
    ).toBe(true);
  });

  it('si el proveedor falla, el correo se reintenta con espera y termina fallido al agotar intentos', async () => {
    resultadoEnvio = false;
    await db.query(
      `INSERT INTO correo_salida (destinatario, asunto, html, clave_dedupe, max_intentos)
       VALUES ('zz-prueba-fallo@example.test', 'Prueba fallo', '<p>x</p>', 'zz-prueba:fallo-1', 2)`,
    );
    const objetivo = await db.query<{ id: string }>(
      `SELECT id FROM correo_salida WHERE clave_dedupe = 'zz-prueba:fallo-1'`,
    );
    const ids = [objetivo.rows[0].id];
    const primero = await outbox.procesarPendientes(10, ids);
    expect(primero.reintentos).toBe(1);
    const trasPrimero = await db.query<{
      estado: string;
      intentos: number;
      futuro: boolean;
    }>(
      `SELECT estado, intentos, proximo_intento > now() AS futuro
       FROM correo_salida WHERE clave_dedupe = 'zz-prueba:fallo-1'`,
    );
    expect(trasPrimero.rows[0]).toMatchObject({
      estado: 'pendiente',
      intentos: 1,
      futuro: true,
    });

    await db.query(
      `UPDATE correo_salida SET proximo_intento = now()
       WHERE clave_dedupe = 'zz-prueba:fallo-1'`,
    );
    const segundo = await outbox.procesarPendientes(10, ids);
    expect(segundo.fallidos).toBe(1);
    const final = await db.query<{ estado: string }>(
      `SELECT estado FROM correo_salida WHERE clave_dedupe = 'zz-prueba:fallo-1'`,
    );
    expect(final.rows[0].estado).toBe('fallido');
  });

  it('sin proveedor configurado los correos permanecen pendientes sin intentos', async () => {
    brevoConfigurado = false;
    await outbox.encolar({
      destinatario: 'zz-prueba-sinbrevo@example.test',
      asunto: 'Prueba sin proveedor',
      html: '<p>x</p>',
      claveDedupe: 'zz-prueba:sinbrevo-1',
    });
    const objetivo = await db.query<{ id: string }>(
      `SELECT id FROM correo_salida WHERE clave_dedupe = 'zz-prueba:sinbrevo-1'`,
    );
    const resultado = await outbox.procesarPendientes(10, [
      objetivo.rows[0].id,
    ]);
    expect(resultado.procesados).toBe(0);
    const fila = await db.query<{ estado: string; intentos: number }>(
      `SELECT estado, intentos FROM correo_salida WHERE clave_dedupe = 'zz-prueba:sinbrevo-1'`,
    );
    expect(fila.rows[0]).toMatchObject({ estado: 'pendiente', intentos: 0 });
  });

  it('crear una notificación encola un correo para el destinatario correcto', async () => {
    await notificaciones.crear({
      userId: CLIENTE,
      tipo: 'prueba_outbox',
      titulo: 'Notificación de prueba',
      mensaje: 'Contenido de prueba del outbox.',
      datos: { pedido_id: '11111111-2222-3333-4444-555555555555' },
    });
    const correo = await db.query<{
      destinatario: string;
      estado: string;
      html: string;
      notificacion_id: string | null;
    }>(
      `SELECT c.destinatario, c.estado, c.html, c.notificacion_id
       FROM correo_salida c
       JOIN notificacion n ON n.id = c.notificacion_id
       WHERE n.user_id = $1 AND n.tipo = 'prueba_outbox'`,
      [CLIENTE],
    );
    expect(correo.rowCount).toBe(1);
    expect(correo.rows[0].destinatario).toBe('zz-prueba-cliente@example.test');
    expect(correo.rows[0].estado).toBe('pendiente');
    expect(correo.rows[0].html).toContain('QuantumWare');
    expect(correo.rows[0].html).toContain('Notificación de prueba');
    expect(correo.rows[0].html).toContain('11111111'.toUpperCase());
  });

  it('una notificación deduplicada no encola correos repetidos', async () => {
    const n = {
      userId: CLIENTE,
      tipo: 'prueba_dedupe',
      titulo: 'Alerta repetida',
      mensaje: 'Primera alerta.',
      claveDedupe: 'zz-prueba:alerta',
    };
    await notificaciones.crear(n);
    await notificaciones.crear({ ...n, mensaje: 'Segunda alerta.' });
    const correos = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM correo_salida c
       JOIN notificacion no ON no.id = c.notificacion_id
       WHERE no.user_id = $1 AND no.tipo = 'prueba_dedupe'`,
      [CLIENTE],
    );
    expect(Number(correos.rows[0].n)).toBe(1);
  });

  it('las notificaciones para administradores llegan a cada administrador con correo, sin fuga al cliente', async () => {
    const admins = await db.query<{ user_id: string; email: string | null }>(
      `SELECT ur.user_id, p.email FROM user_roles ur
       LEFT JOIN perfil_usuario p ON p.user_id = ur.user_id
       WHERE ur.rol = 'admin'`,
    );
    await notificaciones.crearParaAdmins({
      tipo: 'prueba_admins',
      titulo: 'Evento administrativo',
      mensaje: 'Solo para administración.',
    });
    const correos = await db.query<{ destinatario: string }>(
      `SELECT c.destinatario FROM correo_salida c
       JOIN notificacion n ON n.id = c.notificacion_id
       WHERE n.tipo = 'prueba_admins'`,
    );
    const destinatarios = correos.rows.map((f) => f.destinatario).sort();
    const esperados = admins.rows
      .filter((admin) => admin.email)
      .map((admin) => admin.email as string)
      .sort();
    expect(destinatarios).toEqual(esperados);
    const notis = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notificacion WHERE tipo = 'prueba_admins'`,
    );
    expect(Number(notis.rows[0].n)).toBe(admins.rows.length);
  });

  it('si la transacción del negocio se revierte, no queda ni la notificación ni el correo', async () => {
    await expect(
      db.transaction(async (client) => {
        await notificaciones.crear(
          {
            userId: CLIENTE,
            tipo: 'prueba_rollback',
            titulo: 'No debería existir',
            mensaje: 'Esta notificación debe revertirse.',
          },
          client,
        );
        throw new Error('fallo simulado del negocio');
      }),
    ).rejects.toThrow('fallo simulado del negocio');

    const notis = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notificacion WHERE tipo = 'prueba_rollback'`,
    );
    const correos = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM correo_salida WHERE asunto LIKE '%No debería existir%'`,
    );
    expect(Number(notis.rows[0].n)).toBe(0);
    expect(Number(correos.rows[0].n)).toBe(0);
  });

  it('un fallo del proveedor no anula la notificación interna ya registrada', async () => {
    resultadoEnvio = false;
    await notificaciones.crear({
      userId: CLIENTE,
      tipo: 'prueba_fallo_proveedor',
      titulo: 'Notificación persistente',
      mensaje: 'Debe conservarse aunque el correo falle.',
    });
    const objetivo = await db.query<{ id: string }>(
      `SELECT c.id FROM correo_salida c
       JOIN notificacion n ON n.id = c.notificacion_id
       WHERE n.tipo = 'prueba_fallo_proveedor'`,
    );
    await outbox.procesarPendientes(10, [objetivo.rows[0].id]);
    const noti = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notificacion
       WHERE user_id = $1 AND tipo = 'prueba_fallo_proveedor'`,
      [CLIENTE],
    );
    expect(Number(noti.rows[0].n)).toBe(1);
    const correo = await db.query<{ estado: string }>(
      `SELECT c.estado FROM correo_salida c
       JOIN notificacion n ON n.id = c.notificacion_id
       WHERE n.tipo = 'prueba_fallo_proveedor'`,
    );
    expect(correo.rows[0].estado).toBe('pendiente');
  });
});
