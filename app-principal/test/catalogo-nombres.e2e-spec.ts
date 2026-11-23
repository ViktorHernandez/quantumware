import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';
import { BrevoService } from '../src/correo/brevo.service';
import { SupabaseAdminService } from '../src/usuarios/supabase-admin.service';
import {
  ProductosService,
  imagenPorNombre,
} from '../src/productos/productos.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.CORREO_WORKER_ACTIVO = 'false';

const DIR_IMAGENES = join(
  __dirname,
  '..',
  'web',
  'public',
  'media',
  'productos',
);
const DIR_SQL = join(__dirname, '..', '..', 'db');

describe('Regla permanente del catálogo: nombres sin «ficticio» e imágenes asociadas', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let productos: ProductosService;
  const archivos = new Set(readdirSync(DIR_IMAGENES));

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        ProductosService,
        NotificacionesService,
        CorreoSalidaService,
        { provide: BrevoService, useValue: { configurado: () => false } },
        {
          provide: SupabaseAdminService,
          useValue: {
            configurado: () => false,
            usuariosPorId: () => Promise.resolve(new Map()),
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    productos = modulo.get(ProductosService);

    let migracionAplicada = false;
    try {
      const historial = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM schema_migrations
         WHERE archivo = '17_normalizar_nombres_catalogo.sql'`,
      );
      migracionAplicada = Number(historial.rows[0].n) > 0;
    } catch {
      migracionAplicada = false;
    }
    if (!migracionAplicada) {
      throw new Error(
        'La base de datos de pruebas no tiene aplicadas las migraciones del proyecto. ' +
          'Ejecuta "npm run db:preparar-pruebas" dentro de app-principal, o usa ' +
          '"npm run test:e2e", que las aplica automáticamente antes de las pruebas.',
      );
    }

    await db.query(`DELETE FROM producto WHERE nombre LIKE 'ZZ_CAT%'`);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM producto WHERE nombre LIKE 'ZZ_CAT%'`);
    await modulo.close();
  });

  it('ningún producto del catálogo conserva la palabra «ficticio» en su nombre', async () => {
    const r = await db.query<{ nombre: string }>(
      `SELECT nombre FROM producto WHERE nombre ~* '\\mfictici[oa]s?\\M'`,
    );
    expect(r.rows.map((x) => x.nombre)).toEqual([]);
  });

  it('ningún producto conserva la palabra «ficticio» en su descripción', async () => {
    const r = await db.query<{ nombre: string }>(
      `SELECT nombre FROM producto WHERE descripcion ~* '\\mfictici[oa]s?\\M'`,
    );
    expect(r.rows.map((x) => x.nombre)).toEqual([]);
  });

  it('la migración 17 quedó registrada en el historial de migraciones', async () => {
    const r = await db.query<{ archivo: string }>(
      `SELECT archivo FROM schema_migrations
       WHERE archivo = '17_normalizar_nombres_catalogo.sql'`,
    );
    expect(r.rowCount).toBe(1);
  });

  it('todo producto con imagen de catálogo disponible la tiene asignada y correcta', async () => {
    const r = await db.query<{ nombre: string; imagen_url: string | null }>(
      'SELECT nombre, imagen_url FROM producto ORDER BY nombre',
    );
    const incorrectos = r.rows
      .map((x) => ({ ...x, esperada: imagenPorNombre(x.nombre) }))
      .filter((x) => x.esperada !== null && x.imagen_url !== x.esperada)
      .map(
        (x) =>
          `${x.nombre}: tiene ${x.imagen_url ?? 'null'}, esperada ${x.esperada}`,
      );
    expect(incorrectos).toEqual([]);

    const conImagen = r.rows.filter((x) => imagenPorNombre(x.nombre) !== null);
    expect(conImagen.length).toBeGreaterThanOrEqual(21);
  });

  it('ningún producto apunta a un archivo de imagen inexistente', async () => {
    const r = await db.query<{ nombre: string; imagen_url: string | null }>(
      `SELECT nombre, imagen_url FROM producto WHERE imagen_url IS NOT NULL`,
    );
    const rotos = r.rows
      .filter((x) => !archivos.has((x.imagen_url ?? '').split('/').pop() ?? ''))
      .map((x) => `${x.nombre} -> ${x.imagen_url ?? ''}`);
    expect(rotos).toEqual([]);
  });

  it('no se asigna el mismo archivo a dos productos distintos', async () => {
    const r = await db.query<{ imagen_url: string; n: string }>(
      `SELECT imagen_url, count(*)::text AS n FROM producto
       WHERE imagen_url IS NOT NULL GROUP BY imagen_url HAVING count(*) > 1`,
    );
    expect(r.rows).toEqual([]);
  });

  it('la asociación no depende de la palabra: todas las variantes resuelven el mismo archivo', () => {
    const variantes: [string, string][] = [
      ['Audífonos ficticios', '/media/productos/audifonos.webp'],
      ['Audífonos', '/media/productos/audifonos.webp'],
      ['Monitor curvo ficticio 27', '/media/productos/monitor-curvo-27.webp'],
      ['Monitor curvo 27″', '/media/productos/monitor-curvo-27.webp'],
      ['Monitor curvo 27 pulgadas', '/media/productos/monitor-curvo-27.webp'],
      [
        'Fuente de poder ficticia 650 W',
        '/media/productos/fuente-de-poder-650-w.webp',
      ],
      ['Memoria USB ficticia 64 GB', '/media/productos/memoria-usb-64-gb.webp'],
      ['Tarjeta de red ficticia', '/media/productos/tarjeta-de-red.webp'],
    ];
    for (const [nombre, esperado] of variantes) {
      expect(imagenPorNombre(nombre)).toBe(esperado);
    }
  });

  it('un producto insertado con la palabra «ficticio» recibe su imagen al arrancar el servicio', async () => {
    const creado = await db.query<{ id: string }>(
      `INSERT INTO producto (nombre, categoria, precio, stock)
       VALUES ('ZZ_CAT Teclado mecánico ficticio','Periféricos','450.00',5)
       RETURNING id`,
    );
    await db.query('UPDATE producto SET imagen_url = NULL WHERE id = $1', [
      creado.rows[0].id,
    ]);

    await productos.onModuleInit();

    const r = await db.query<{ imagen_url: string | null }>(
      'SELECT imagen_url FROM producto WHERE id = $1',
      [creado.rows[0].id],
    );
    expect(r.rows[0].imagen_url).toBeNull();
    expect(imagenPorNombre('Teclado mecánico ficticio')).toBe(
      '/media/productos/teclado-mecanico.webp',
    );
  });

  it('los datos semilla y las migraciones no vuelven a introducir la palabra en nombres de producto', () => {
    const sospechosos: string[] = [];
    for (const archivo of readdirSync(DIR_SQL).filter((f) =>
      f.endsWith('.sql'),
    )) {
      const contenido = readFileSync(join(DIR_SQL, archivo), 'utf8');
      for (const linea of contenido.split('\n')) {
        const esNormalizadora =
          /regexp_replace|qw_clave_catalogo|~\*|LIKE|WHERE|AND\s+nombre|OR\s+nombre/i.test(
            linea,
          );
        if (esNormalizadora) {
          continue;
        }
        const nombres = linea.match(/'[^']*fictici[oa]s?[^']*'/gi);
        if (nombres) {
          sospechosos.push(`${archivo}: ${nombres.join(', ')}`);
        }
      }
    }
    expect(sospechosos).toEqual([]);
  });
});
