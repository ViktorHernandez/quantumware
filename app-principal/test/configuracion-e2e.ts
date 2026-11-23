import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

const BASE_PRUEBAS_POR_OMISION = 'quantumware_pruebas';
const ARCHIVO_ENTORNO = resolve(__dirname, 'entorno-pruebas.json');

process.env.DATABASE_URL = '';
config({ path: resolve(__dirname, '..', '.env'), quiet: true });

process.env.DATABASE_URL = '';
process.env.BREVO_API_KEY = '';
process.env.CORREO_WORKER_ACTIVO = 'false';
process.env.PEDIDO_AVANCE_AUTOMATICO = 'false';

interface EntornoPruebas {
  database?: string | null;
  schema?: string | null;
}

function entornoRegistrado(): EntornoPruebas {
  if (!existsSync(ARCHIVO_ENTORNO)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(ARCHIVO_ENTORNO, 'utf8')) as EntornoPruebas;
  } catch {
    return {};
  }
}

const registrado = entornoRegistrado();

const base =
  process.env.TEST_DATABASE_NAME ??
  registrado.database ??
  BASE_PRUEBAS_POR_OMISION;

const esquema = (
  process.env.TEST_DATABASE_SCHEMA ??
  registrado.schema ??
  ''
).trim();

const esBaseDedicada = /(prueba|test)/i.test(base);
const esEsquemaDedicado = esquema !== '' && esquema !== 'public';

if (!esBaseDedicada && !esEsquemaDedicado) {
  throw new Error(
    `La suite E2E solo puede ejecutarse contra una base de datos de pruebas o un esquema aislado. ` +
      `Resolvió base "${base}" y esquema "${esquema || 'public'}". ` +
      `Ejecuta "npm run db:preparar-pruebas" para preparar el entorno. ` +
      `Esta comprobación evita que las pruebas modifiquen datos reales.`,
  );
}

process.env.DATABASE_NAME = base;
process.env.DATABASE_SCHEMA = esquema;
