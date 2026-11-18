import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import { ProductosService } from '../src/productos/productos.service';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { UpdateProductoDto } from '../src/productos/dto/update-producto.dto';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.CORREO_WORKER_ACTIVO = 'false';

const CLIENTE_IMG = '00000000-0000-0000-0000-00000000i0c1'.replace(
  'i0c',
  'd0c',
);

describe('Asociación de imágenes de catálogo (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let productos: ProductosService;
  let pedidos: PedidosService;

  async function limpiar() {
    await db.query(`DELETE FROM producto WHERE nombre LIKE 'ZZ_IMG%'`);
    await db.query('DELETE FROM pedido WHERE cliente_sub = $1', [CLIENTE_IMG]);
    await db.query(`DELETE FROM producto WHERE nombre = 'Audífonos ZZ'`);
  }

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        ConfigService,
        CorreoSalidaService,
        NotificacionesService,
        ProductosService,
        PedidosService,
        { provide: BrevoService, useValue: { configurado: () => false } },
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => false,
            usuariosPorId: () =>
              Promise.resolve(new Map<string, { email: string | null }>()),
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    productos = modulo.get(ProductosService);
    pedidos = modulo.get(PedidosService);
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  it('un producto cuyo nombre coincide con una imagen del catálogo la recibe automáticamente', async () => {
    const p = await productos.crear({
      nombre: 'Audífonos',
      precio: 640,
      stock: 5,
    });
    expect(p.imagen_url).toBe('/media/productos/audifonos.webp');
    await db.query('DELETE FROM producto WHERE id = $1', [p.id]);
  });

  it('respeta acentos y comillas tipográficas al resolver el nombre', async () => {
    const p = await productos.crear({
      nombre: 'Monitor de prueba 24″',
      precio: 100,
      stock: 1,
    });
    expect(p.imagen_url).toBe('/media/productos/monitor-de-prueba-24.webp');
    await db.query('DELETE FROM producto WHERE id = $1', [p.id]);
  });

  it('un producto con nombre propio queda sin imagen y el administrador puede asignarla', async () => {
    const p = await productos.crear({
      nombre: 'ZZ_IMG_PERSONALIZADO',
      precio: 50,
      stock: 2,
    });
    expect(p.imagen_url).toBeNull();

    const actualizado = await productos.actualizar(p.id, {
      imagen_url: '/media/productos/teclado-mecanico.webp',
    });
    expect(actualizado.imagen_url).toBe(
      '/media/productos/teclado-mecanico.webp',
    );

    const persistido = await db.query<{ imagen_url: string }>(
      'SELECT imagen_url FROM producto WHERE id = $1',
      [p.id],
    );
    expect(persistido.rows[0].imagen_url).toBe(
      '/media/productos/teclado-mecanico.webp',
    );
  });

  it('rechaza una imagen_url que no sea una ruta del catálogo', async () => {
    const dto = plainToInstance(UpdateProductoDto, {
      imagen_url: 'https://sitio-externo.example/foto.png',
    });
    const errores = await validate(dto);
    expect(errores.length).toBeGreaterThan(0);
  });

  it('acepta una ruta válida del catálogo', async () => {
    const dto = plainToInstance(UpdateProductoDto, {
      imagen_url: '/media/productos/mouse-optico.webp',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('la asociación persiste tras reiniciar: el arranque rellena las que falten', async () => {
    const p = await productos.crear({
      nombre: 'Mouse óptico',
      precio: 10,
      stock: 1,
    });
    await db.query('UPDATE producto SET imagen_url = NULL WHERE id = $1', [
      p.id,
    ]);
    await productos.onModuleInit();
    const r = await db.query<{ imagen_url: string | null }>(
      'SELECT imagen_url FROM producto WHERE id = $1',
      [p.id],
    );
    expect(r.rows[0].imagen_url).toBe('/media/productos/mouse-optico.webp');
    await db.query('DELETE FROM producto WHERE id = $1', [p.id]);
  });

  it('las líneas del pedido incluyen la imagen del producto (carrito y pedidos)', async () => {
    const creado = await productos.crear({
      nombre: 'Audífonos ZZ',
      categoria: 'Audio',
      precio: '390.00',
      stock: 5,
    } as never);
    await db.query('UPDATE producto SET imagen_url = $2 WHERE id = $1', [
      creado.id,
      '/media/productos/audifonos.webp',
    ]);

    const pedido = await pedidos.checkout(CLIENTE_IMG, {
      items: [{ producto_id: creado.id, cantidad: 1 }],
    });
    const detalle = await pedidos.obtener(pedido.id, CLIENTE_IMG, true);

    expect(detalle.items).toHaveLength(1);
    expect(detalle.items[0].imagen_url).toBe('/media/productos/audifonos.webp');
  });
});
