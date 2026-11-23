import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { MigracionesCheckService } from '../src/database/migraciones-check.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';

describe('Esquema de base de datos requerido por la aplicación (integración)', () => {
  let modulo: TestingModule;
  let chequeo: MigracionesCheckService;

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [DatabaseService, MigracionesCheckService],
    }).compile();
    chequeo = modulo.get(MigracionesCheckService);
  });

  afterAll(async () => {
    await modulo.close();
  });

  it('la base de datos tiene todas las migraciones que usan pedidos, pagos y notificaciones', async () => {
    await chequeo.verificar();
    const estado = chequeo.estado();
    if (estado.esquema !== 'al_dia') {
      throw new Error(
        `Migraciones pendientes: ${estado.migracionesPendientes.join(', ') || 'no se pudo verificar'}. ` +
          'Sin ellas, consultar pedidos, pagar o notificar responde 500. Aplica db\\aplicar-migraciones.ps1.',
      );
    }
    expect(estado.esquema).toBe('al_dia');
  });

  it('la tabla pedido tiene las columnas que consultan listar, obtener y pagar', async () => {
    const db = modulo.get(DatabaseService);
    const r = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'pedido'`,
    );
    const columnas = new Set(r.rows.map((f) => f.column_name));
    for (const col of [
      'estado_pago',
      'metodo_pago',
      'tarjeta_ultimos4',
      'referencia_pago',
      'numero_seguimiento',
      'pagado_en',
      'clave_idempotencia',
    ]) {
      expect(columnas.has(col)).toBe(true);
    }
  });
});
