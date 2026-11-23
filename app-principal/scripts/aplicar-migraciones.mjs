import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizApp = resolve(aqui, '..');
const carpetaSql = resolve(raizApp, '..', 'db');

dotenv.config({ path: join(raizApp, '.env'), quiet: true });

const argumentos = new Set(process.argv.slice(2));
const crearBase = argumentos.has('--crear');
const silencioso = argumentos.has('--silencioso');
const modoPruebas = argumentos.has('--pruebas');
const reiniciar = argumentos.has('--reiniciar');

const BASE_PRUEBAS_POR_OMISION = 'quantumware_pruebas';
const ESQUEMA_PRUEBAS_POR_OMISION = 'pruebas';
const ARCHIVO_ENTORNO = resolve(raizApp, 'test', 'entorno-pruebas.json');

const baseSolicitada = modoPruebas
  ? (process.env.TEST_DATABASE_NAME ?? BASE_PRUEBAS_POR_OMISION)
  : (process.env.MIGRACIONES_DATABASE_NAME ??
    process.env.DATABASE_NAME ??
    'quantumware');

const conexion = {
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? '5432'),
  user: process.env.DATABASE_USER ?? 'quantumware_app',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: baseSolicitada,
};

const urlDirecta = (process.env.MIGRACIONES_DATABASE_URL ?? '').trim();

function registrar(mensaje) {
  if (!silencioso) {
    console.log(mensaje);
  }
}

function nuevoCliente(base) {
  if (urlDirecta) {
    return new pg.Client({
      connectionString: urlDirecta,
      ssl: { rejectUnauthorized: false },
    });
  }
  return new pg.Client({ ...conexion, database: base });
}

async function existeBase(nombre) {
  const mantenimiento = new pg.Client({ ...conexion, database: 'postgres' });
  try {
    await mantenimiento.connect();
  } catch {
    return null;
  }
  try {
    const r = await mantenimiento.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [nombre],
    );
    return r.rowCount > 0;
  } catch {
    return null;
  } finally {
    await mantenimiento.end();
  }
}

async function intentarCrearBase(nombre) {
  const mantenimiento = new pg.Client({ ...conexion, database: 'postgres' });
  try {
    await mantenimiento.connect();
  } catch (error) {
    return {
      creada: false,
      motivo: error instanceof Error ? error.message : String(error),
    };
  }
  try {
    await mantenimiento.query(
      `CREATE DATABASE "${nombre.replace(/"/g, '""')}"`,
    );
    return { creada: true };
  } catch (error) {
    return {
      creada: false,
      motivo: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await mantenimiento.end();
  }
}

async function resolverDestinoPruebas() {
  const esquemaPedido =
    process.env.TEST_DATABASE_SCHEMA ?? ESQUEMA_PRUEBAS_POR_OMISION;

  if (process.env.TEST_DATABASE_SCHEMA) {
    return {
      database: process.env.DATABASE_NAME ?? 'quantumware',
      schema: esquemaPedido,
      motivo: 'TEST_DATABASE_SCHEMA fijado explícitamente',
    };
  }

  const yaExiste = await existeBase(baseSolicitada);
  if (yaExiste === true) {
    return {
      database: baseSolicitada,
      schema: null,
      motivo: 'la base de pruebas ya existía',
    };
  }

  if (yaExiste === false && crearBase) {
    const intento = await intentarCrearBase(baseSolicitada);
    if (intento.creada) {
      return {
        database: baseSolicitada,
        schema: null,
        motivo: 'base de pruebas creada',
      };
    }
    registrar(
      `No se pudo crear la base ${baseSolicitada} (${intento.motivo}). ` +
        `Se usará un esquema aislado dentro de la base principal, que no requiere permisos adicionales.`,
    );
  }

  const principal = process.env.DATABASE_NAME ?? 'quantumware';
  return {
    database: principal,
    schema: esquemaPedido,
    motivo: 'esquema aislado dentro de la base existente',
  };
}

async function principal() {
  let destino = { database: baseSolicitada, schema: null, motivo: '' };
  if (modoPruebas) {
    destino = await resolverDestinoPruebas();
    registrar(
      `Entorno de pruebas: base ${destino.database}` +
        (destino.schema ? `, esquema ${destino.schema}` : '') +
        ` (${destino.motivo}).`,
    );
  } else if (crearBase) {
    const yaExiste = await existeBase(baseSolicitada);
    if (yaExiste === false) {
      const intento = await intentarCrearBase(baseSolicitada);
      if (!intento.creada) {
        throw new Error(
          `No fue posible crear la base de datos ${baseSolicitada}: ${intento.motivo}. ` +
            `Créala con un usuario con permiso: CREATE DATABASE ${baseSolicitada} OWNER ${conexion.user};`,
        );
      }
      registrar(`Base de datos creada: ${baseSolicitada}`);
    }
  }

  const archivos = readdirSync(carpetaSql)
    .filter((n) => n.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const cliente = nuevoCliente(destino.database);
  await cliente.connect();

  if (destino.schema) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(destino.schema)) {
      throw new Error(
        `El nombre de esquema "${destino.schema}" no es válido. Usa solo letras, dígitos y guion bajo.`,
      );
    }
    if (reiniciar) {
      if (!modoPruebas) {
        throw new Error('--reiniciar solo se admite junto con --pruebas.');
      }
      if (destino.schema === 'public') {
        throw new Error(
          'Negado: --reiniciar nunca actúa sobre el esquema public.',
        );
      }
      const ubicacionPrevia = await cliente.query(
        'SELECT current_database() AS base',
      );
      registrar(
        `Reiniciando ÚNICAMENTE el esquema "${destino.schema}" de ${ubicacionPrevia.rows[0].base}. ` +
          'El esquema public y sus datos no se tocan.',
      );
      await cliente.query(`DROP SCHEMA IF EXISTS "${destino.schema}" CASCADE`);
    }
    await cliente.query(`CREATE SCHEMA IF NOT EXISTS "${destino.schema}"`);
    await cliente.query(`SET search_path TO "${destino.schema}"`);
  } else if (reiniciar) {
    if (!modoPruebas) {
      throw new Error('--reiniciar solo se admite junto con --pruebas.');
    }
    if (!/(prueba|test)/i.test(destino.database)) {
      throw new Error(
        `Negado: --reiniciar exige una base cuyo nombre contenga "prueba" o "test". ` +
          `El destino resuelto es "${destino.database}".`,
      );
    }
    registrar(
      `Reiniciando el esquema public de la base de pruebas ${destino.database}.`,
    );
    await cliente.query('DROP SCHEMA IF EXISTS public CASCADE');
    await cliente.query('CREATE SCHEMA public');
  }

  const ubicacion = await cliente.query(
    'SELECT current_database() AS base, current_user AS usuario, current_schema() AS esquema',
  );
  registrar(
    `Aplicando migraciones en ${ubicacion.rows[0].base}` +
      `/${ubicacion.rows[0].esquema} como ${ubicacion.rows[0].usuario}`,
  );

  let aplicadas = 0;
  let omitidas = 0;

  try {
    await cliente.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         archivo text PRIMARY KEY,
         aplicada timestamptz NOT NULL DEFAULT now()
       )`,
    );

    for (const archivo of archivos) {
      const yaAplicada = await cliente.query(
        'SELECT 1 FROM schema_migrations WHERE archivo = $1',
        [archivo],
      );
      if (yaAplicada.rowCount > 0) {
        omitidas += 1;
        registrar(`  omitida   ${archivo}`);
        continue;
      }
      const sql = readFileSync(join(carpetaSql, archivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query(
          `INSERT INTO schema_migrations (archivo) VALUES ($1)
           ON CONFLICT (archivo) DO NOTHING`,
          [archivo],
        );
        await cliente.query('COMMIT');
        aplicadas += 1;
        registrar(`  aplicada  ${archivo}`);
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw new Error(
          `Falló ${archivo}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const resumen = await cliente.query(
      `SELECT
         (SELECT count(*) FROM producto) AS productos,
         (SELECT count(*) FROM producto WHERE nombre ~* '\\mfictici[oa]s?\\M') AS nombres_con_palabra,
         (SELECT count(*) FROM producto WHERE descripcion ~* '\\mfictici[oa]s?\\M') AS descripciones_con_palabra,
         (SELECT count(*) FROM schema_migrations) AS migraciones`,
    );
    const r = resumen.rows[0];
    registrar(
      `Migraciones al día: ${aplicadas} aplicada(s), ${omitidas} omitida(s), ${r.migraciones} registrada(s).`,
    );
    registrar(
      `Catálogo: ${r.productos} producto(s), ${r.nombres_con_palabra} con la palabra reservada en el nombre, ${r.descripciones_con_palabra} en la descripción.`,
    );
    if (
      Number(r.nombres_con_palabra) > 0 ||
      Number(r.descripciones_con_palabra) > 0
    ) {
      throw new Error(
        'El catálogo conserva la palabra reservada después de aplicar las migraciones.',
      );
    }

    if (modoPruebas) {
      writeFileSync(
        ARCHIVO_ENTORNO,
        `${JSON.stringify(
          { database: destino.database, schema: destino.schema },
          null,
          2,
        )}\n`,
        'utf8',
      );
      registrar(`Entorno de pruebas registrado en test/entorno-pruebas.json`);
    }
  } finally {
    await cliente.end();
  }
}

principal().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
