import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { MovimientosService } from '../src/movimientos/movimientos.service';
import { PedidosService } from '../src/pedidos/pedidos.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.VULN_MODE = 'corregido';

const USUARIO = '00000000-0000-0000-0000-00000000e001';
const CLIENTE = '00000000-0000-0000-0000-00000000e002';

describe('Movimientos de inventario (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let movimientos: MovimientosService;
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
        MovimientosService,
        PedidosService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    movimientos = modulo.get(MovimientosService);
    pedidos = modulo.get(PedidosService);
    await limpiar();
    const p = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock, stock_minimo) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['ZZ_TEST_MOV', '10.00', 10, 2],
    );
    productoId = p.rows[0].id;
  });

  afterAll(async () => {
    await limpiar();
    await db.query(`DELETE FROM producto WHERE nombre = 'ZZ_TEST_MOV'`);
    await modulo.close();
  });

  async function limpiar() {
    await db.query(
      `DELETE FROM movimiento_inventario WHERE producto_id IN
         (SELECT id FROM producto WHERE nombre = 'ZZ_TEST_MOV')`,
    );
    await db.query(
      `DELETE FROM detalle_pedido WHERE pedido_id IN
         (SELECT id FROM pedido WHERE cliente_sub = $1)`,
      [CLIENTE],
    );
    await db.query('DELETE FROM pedido WHERE cliente_sub = $1', [CLIENTE]);
  }

  async function stock(): Promise<number> {
    const r = await db.query<{ stock: number }>(
      'SELECT stock FROM producto WHERE id = $1',
      [productoId],
    );
    return r.rows[0].stock;
  }

  it('entrada, salida y ajuste mantienen consistencia stock-movimiento', async () => {
    const entrada = await movimientos.crear(
      { producto_id: productoId, tipo: 'entrada', cantidad: 5 },
      USUARIO,
    );
    expect(entrada.stock_resultante).toBe(15);
    expect(await stock()).toBe(15);

    const salida = await movimientos.crear(
      { producto_id: productoId, tipo: 'salida', cantidad: 3 },
      USUARIO,
    );
    expect(salida.stock_resultante).toBe(12);
    expect(await stock()).toBe(12);

    const ajuste = await movimientos.crear(
      { producto_id: productoId, tipo: 'ajuste', cantidad: 100 },
      USUARIO,
    );
    expect(ajuste.stock_resultante).toBe(100);
    expect(await stock()).toBe(100);
  });

  it('rechaza una salida que dejaría las existencias por debajo de cero', async () => {
    await expect(
      movimientos.crear(
        { producto_id: productoId, tipo: 'salida', cantidad: 9999 },
        USUARIO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un pedido no modifica las existencias (protege PE-02)', async () => {
    const antes = await stock();
    await pedidos.crear(CLIENTE, {
      items: [{ producto_id: productoId, cantidad: 3 }],
    });
    expect(await stock()).toBe(antes);
  });
});
