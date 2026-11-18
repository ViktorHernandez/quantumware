import { ConfigModule } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
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

const CLIENTE_A = '00000000-0000-0000-0000-0000000inv01'.replace('inv', 'a0c');
const CLIENTE_B = '00000000-0000-0000-0000-0000000inv02'.replace('inv', 'b0c');

const PAGO = { metodo: 'tarjeta_credito', tarjeta_ultimos4: '4242' };

describe('Inventario en compras confirmadas (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let pedidos: PedidosService;

  async function limpiar() {
    await db.query(
      `DELETE FROM movimiento_inventario WHERE producto_id IN
         (SELECT id FROM producto WHERE nombre LIKE 'ZZ_INV%')`,
    );
    await db.query(`DELETE FROM pedido WHERE cliente_sub = ANY($1::uuid[])`, [
      [CLIENTE_A, CLIENTE_B],
    ]);
    await db.query(`DELETE FROM producto WHERE nombre LIKE 'ZZ_INV%'`);
  }

  async function nuevoProducto(nombre: string, stock: number) {
    const r = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, precio, stock) VALUES ($1,'640.00',$2) RETURNING id`,
      [nombre, stock],
    );
    return r.rows[0].id;
  }

  async function stockDe(id: string) {
    const r = await db.query<{ stock: number }>(
      'SELECT stock FROM producto WHERE id = $1',
      [id],
    );
    return r.rows[0].stock;
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
        NotificacionesService,
        BrevoService,
        CorreoSalidaService,
        PedidosService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    pedidos = modulo.get(PedidosService);
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  it('reproduce el fallo original: una compra confirmada de 2 unidades baja el stock de 22 a 20', async () => {
    const producto = await nuevoProducto('ZZ_INV_AUDIFONOS', 22);
    const pedido = await pedidos.checkout(CLIENTE_A, {
      items: [{ producto_id: producto, cantidad: 2 }],
    });

    expect(await stockDe(producto)).toBe(22);

    await pedidos.pagar(pedido.id, CLIENTE_A, PAGO);

    expect(await stockDe(producto)).toBe(20);
  });

  it('registra el movimiento de salida con trazabilidad al pedido', async () => {
    const producto = await nuevoProducto('ZZ_INV_TRAZA', 10);
    const pedido = await pedidos.checkout(CLIENTE_A, {
      items: [{ producto_id: producto, cantidad: 3 }],
    });
    await pedidos.pagar(pedido.id, CLIENTE_A, PAGO);

    const mov = await db.query<{
      tipo: string;
      cantidad: number;
      stock_resultante: number;
      pedido_id: string;
      motivo: string;
    }>(
      `SELECT tipo, cantidad, stock_resultante, pedido_id, motivo
       FROM movimiento_inventario WHERE producto_id = $1`,
      [producto],
    );
    expect(mov.rowCount).toBe(1);
    expect(mov.rows[0].tipo).toBe('salida');
    expect(mov.rows[0].cantidad).toBe(3);
    expect(mov.rows[0].stock_resultante).toBe(7);
    expect(mov.rows[0].pedido_id).toBe(pedido.id);
    expect(mov.rows[0].motivo).toContain('Venta del pedido');
  });

  it('no descuenta dos veces si se reintenta el pago del mismo pedido', async () => {
    const producto = await nuevoProducto('ZZ_INV_IDEMPOTENTE', 10);
    const pedido = await pedidos.checkout(CLIENTE_A, {
      items: [{ producto_id: producto, cantidad: 4 }],
    });
    await pedidos.pagar(pedido.id, CLIENTE_A, PAGO);
    await pedidos.pagar(pedido.id, CLIENTE_A, PAGO);
    await pedidos.pagar(pedido.id, CLIENTE_A, PAGO);

    expect(await stockDe(producto)).toBe(6);
    const mov = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM movimiento_inventario WHERE producto_id = $1`,
      [producto],
    );
    expect(Number(mov.rows[0].n)).toBe(1);
  });

  it('agregar al carrito no descuenta inventario (un carrito abandonado no es una venta)', async () => {
    const producto = await nuevoProducto('ZZ_INV_CARRITO', 15);
    await pedidos.checkout(CLIENTE_A, {
      items: [{ producto_id: producto, cantidad: 5 }],
    });
    expect(await stockDe(producto)).toBe(15);
  });

  it('dos clientes compitiendo por la última unidad: solo uno puede pagar y el stock nunca queda negativo', async () => {
    const producto = await nuevoProducto('ZZ_INV_CARRERA', 1);
    const pedidoA = await pedidos.checkout(CLIENTE_A, {
      items: [{ producto_id: producto, cantidad: 1 }],
    });
    const pedidoB = await pedidos.checkout(CLIENTE_B, {
      items: [{ producto_id: producto, cantidad: 1 }],
    });

    const resultados = await Promise.allSettled([
      pedidos.pagar(pedidoA.id, CLIENTE_A, PAGO),
      pedidos.pagar(pedidoB.id, CLIENTE_B, PAGO),
    ]);
    const exitosos = resultados.filter((r) => r.status === 'fulfilled').length;
    const fallidos = resultados.filter((r) => r.status === 'rejected');

    expect(exitosos).toBe(1);
    expect(fallidos.length).toBe(1);
    expect(fallidos[0].reason).toBeInstanceOf(ConflictException);
    expect(await stockDe(producto)).toBe(0);
  });

  it('la cancelación de un pedido pagado restaura el inventario una sola vez', async () => {
    const producto = await nuevoProducto('ZZ_INV_CANCELA', 12);
    const pedido = await pedidos.checkout(CLIENTE_A, {
      items: [{ producto_id: producto, cantidad: 5 }],
    });
    await pedidos.pagar(pedido.id, CLIENTE_A, PAGO);
    expect(await stockDe(producto)).toBe(7);

    await pedidos.cambiarEstado(pedido.id, 'cancelado');
    expect(await stockDe(producto)).toBe(12);

    const entradas = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM movimiento_inventario
       WHERE producto_id = $1 AND tipo = 'entrada'`,
      [producto],
    );
    expect(Number(entradas.rows[0].n)).toBe(1);

    const bandera = await db.query<{ inventario_descontado: boolean }>(
      'SELECT inventario_descontado FROM pedido WHERE id = $1',
      [pedido.id],
    );
    expect(bandera.rows[0].inventario_descontado).toBe(false);
  });

  it('un pago rechazado no descuenta inventario', async () => {
    const producto = await nuevoProducto('ZZ_INV_RECHAZO', 9);
    const pedido = await pedidos.checkout(CLIENTE_A, {
      items: [{ producto_id: producto, cantidad: 2 }],
    });
    await pedidos.pagar(pedido.id, CLIENTE_A, {
      metodo: 'tarjeta_credito',
      tarjeta_ultimos4: '0002',
    });
    expect(await stockDe(producto)).toBe(9);
  });
});
