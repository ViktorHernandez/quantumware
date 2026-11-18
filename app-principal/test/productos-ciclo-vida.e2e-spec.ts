import { ConfigModule } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { ProductosService } from '../src/productos/productos.service';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? '';
process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.VULN_MODE = 'corregido';

describe('Ciclo de vida de producto (integración con BD)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let productos: ProductosService;
  const PREFIJO = 'ZZ_TEST_CICLO_';

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
        ProductosService,
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    productos = modulo.get(ProductosService);
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  async function limpiar() {
    await db.query(
      `DELETE FROM detalle_pedido WHERE producto_id IN
         (SELECT id FROM producto WHERE nombre LIKE $1)`,
      [`${PREFIJO}%`],
    );
    await db.query(
      `DELETE FROM movimiento_inventario WHERE producto_id IN
         (SELECT id FROM producto WHERE nombre LIKE $1)`,
      [`${PREFIJO}%`],
    );
    await db.query(`DELETE FROM producto WHERE nombre LIKE $1`, [
      `${PREFIJO}%`,
    ]);
    await db.query(`DELETE FROM pedido WHERE cliente_sub = $1`, [
      '00000000-0000-0000-0000-0000000000aa',
    ]);
  }

  it('elimina físicamente un producto sin referencias', async () => {
    const creado = await productos.crear({
      nombre: `${PREFIJO}SIN_REF`,
      precio: '10.00',
      stock: 100,
      stock_minimo: 0,
    } as never);
    expect(creado.estado).toBe('activo');

    const res = await productos.eliminar(creado.id);
    expect(res.eliminado).toBe(true);
    await expect(productos.obtener(creado.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza con 409 el borrado de un producto con pedidos y conserva el producto', async () => {
    const creado = await productos.crear({
      nombre: `${PREFIJO}CON_REF`,
      precio: '25.00',
      stock: 100,
      stock_minimo: 0,
    } as never);

    const pedido = await db.query<{ id: string }>(
      `INSERT INTO pedido (cliente_sub, total) VALUES ($1, $2) RETURNING id`,
      ['00000000-0000-0000-0000-0000000000aa', '25.00'],
    );
    await db.query(
      `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)`,
      [pedido.rows[0].id, creado.id, 1, '25.00'],
    );

    await expect(productos.eliminar(creado.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    const sigue = await productos.obtener(creado.id);
    expect(sigue.id).toBe(creado.id);
  });

  it('archiva en vez de borrar y lo excluye del catálogo activo', async () => {
    const creado = await productos.crear({
      nombre: `${PREFIJO}ARCHIVAR`,
      precio: '30.00',
      stock: 100,
      stock_minimo: 0,
    } as never);

    const archivado = await productos.archivar(creado.id);
    expect(archivado.estado).toBe('archivado');

    const activos = (await productos.listar({}, false)) as { id: string }[];
    expect(activos.find((p) => p.id === creado.id)).toBeUndefined();

    const todos = (await productos.listar({ estado: 'todos' }, true)) as {
      id: string;
    }[];
    expect(todos.find((p) => p.id === creado.id)).toBeDefined();

    const reactivado = await productos.reactivar(creado.id);
    expect(reactivado.estado).toBe('activo');
  });
});
