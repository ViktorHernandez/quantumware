import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Subscription } from 'rxjs';
import { DatabaseService } from '../src/database/database.service';
import {
  EventoNotificacion,
  NotificacionesService,
} from '../src/notificaciones/notificaciones.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';

const USER_A = '00000000-0000-0000-0000-00000000a001';
const USER_B = '00000000-0000-0000-0000-00000000b002';

describe('Notificaciones en tiempo real (integración con BD)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let service: NotificacionesService;
  const subs: Subscription[] = [];

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
        NotificacionesService,
        BrevoService,
        CorreoSalidaService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    service = modulo.get(NotificacionesService);
    await limpiar();
  });

  afterAll(async () => {
    subs.forEach((s) => s.unsubscribe());
    await limpiar();
    await modulo.close();
  });

  async function limpiar() {
    await db.query('DELETE FROM notificacion WHERE user_id = ANY($1::uuid[])', [
      [USER_A, USER_B],
    ]);
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])', [
      [USER_A, USER_B],
    ]);
  }

  it('entrega el evento al usuario destinatario y no a otro', async () => {
    const recibidosA: EventoNotificacion[] = [];
    const recibidosB: EventoNotificacion[] = [];
    subs.push(service.flujo(USER_A).subscribe((e) => recibidosA.push(e.data)));
    subs.push(service.flujo(USER_B).subscribe((e) => recibidosB.push(e.data)));

    await service.crear({
      userId: USER_A,
      tipo: 'prueba',
      titulo: 'Para A',
      mensaje: 'Mensaje dirigido a A',
    });

    expect(recibidosA).toHaveLength(1);
    expect(recibidosA[0].titulo).toBe('Para A');
    expect(recibidosB).toHaveLength(0);
  });

  it('solo los administradores reciben los eventos para administradores', async () => {
    await db.query(
      `INSERT INTO user_roles (user_id, rol) VALUES ($1, 'admin'), ($2, 'cliente')`,
      [USER_A, USER_B],
    );
    const recibidosA: EventoNotificacion[] = [];
    const recibidosB: EventoNotificacion[] = [];
    subs.push(service.flujo(USER_A).subscribe((e) => recibidosA.push(e.data)));
    subs.push(service.flujo(USER_B).subscribe((e) => recibidosB.push(e.data)));

    await service.crearParaAdmins({
      tipo: 'pedido_nuevo',
      titulo: 'Evento administrativo',
      mensaje: 'Solo para admins',
    });

    expect(recibidosA.some((e) => e.titulo === 'Evento administrativo')).toBe(
      true,
    );
    expect(recibidosB.some((e) => e.titulo === 'Evento administrativo')).toBe(
      false,
    );
  });
});
