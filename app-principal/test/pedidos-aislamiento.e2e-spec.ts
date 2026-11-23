import { ConfigModule } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { PedidosService } from '../src/pedidos/pedidos.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.VULN_MODE = 'corregido';

const CLIENTE_A = '00000000-0000-0000-0000-00000000c0a1';
const CLIENTE_B = '00000000-0000-0000-0000-00000000c0b2';

describe('Aislamiento de pedidos por usuario (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let pedidos: PedidosService;
  let productoId: string;

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
        PedidosService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    pedidos = modulo.get(PedidosService);
    await limpiar();
    const p = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,$2,$3) RETURNING id`,
      ['ZZ_TEST_AISLA', '10.00', 100],
    );
    productoId = p.rows[0].id;
  });

  afterAll(async () => {
    await limpiar();
    await db.query(`DELETE FROM producto WHERE nombre = 'ZZ_TEST_AISLA'`);
    await modulo.close();
  });

  async function limpiar() {
    await db.query(
      `DELETE FROM detalle_pedido WHERE pedido_id IN
         (SELECT id FROM pedido WHERE cliente_sub = ANY($1::uuid[]))`,
      [[CLIENTE_A, CLIENTE_B]],
    );
    await db.query('DELETE FROM pedido WHERE cliente_sub = ANY($1::uuid[])', [
      [CLIENTE_A, CLIENTE_B],
    ]);
  }

  it('un cliente con todos=true solo ve sus propios pedidos', async () => {
    await pedidos.crear(CLIENTE_A, {
      items: [{ producto_id: productoId, cantidad: 1 }],
    });
    const pedidoB = await pedidos.crear(CLIENTE_B, {
      items: [{ producto_id: productoId, cantidad: 2 }],
    });

    const vistaCliente = (await pedidos.listar(CLIENTE_A, false, {
      todos: 'true',
    })) as { cliente_sub: string }[];
    expect(vistaCliente.length).toBeGreaterThan(0);
    expect(vistaCliente.every((p) => p.cliente_sub === CLIENTE_A)).toBe(true);

    const vistaAdmin = (await pedidos.listar(CLIENTE_A, true, {
      todos: 'true',
    })) as { cliente_sub: string }[];
    const subs = new Set(vistaAdmin.map((p) => p.cliente_sub));
    expect(subs.has(CLIENTE_A)).toBe(true);
    expect(subs.has(CLIENTE_B)).toBe(true);

    await expect(
      pedidos.obtener(pedidoB.id, CLIENTE_A, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
