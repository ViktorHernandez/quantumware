import { resolve } from 'path';
import { config } from 'dotenv';

process.env.DATABASE_URL = '';
config({ path: resolve(__dirname, '..', '.env'), quiet: true });
process.env.DATABASE_URL = '';
process.env.BREVO_API_KEY = '';
process.env.CORREO_WORKER_ACTIVO = 'false';
