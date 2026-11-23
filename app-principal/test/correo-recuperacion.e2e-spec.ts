import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../src/database/database.service';
import { BrevoService } from '../src/correo/brevo.service';
import { CorreoSalidaService } from '../src/correo/correo-salida.service';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quantumware';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'quantumware_app';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'lab_pw_local';
process.env.CORREO_WORKER_ACTIVO = 'false';

describe('Robustez del envío de correo (integración)', () => {
  let modulo: TestingModule;
  let db: DatabaseService;
  let outbox: CorreoSalidaService;
  let resultado: { enviado: boolean; permanente: boolean; detalle?: string };

  async function limpiar() {
    await db.query(
      `DELETE FROM correo_salida WHERE clave_dedupe LIKE 'zz-rec:%'`,
    );
  }

  async function fila(clave: string) {
    const r = await db.query<{
      id: string;
      estado: string;
      intentos: number;
      ultimo_error: string | null;
    }>(
      `SELECT id, estado, intentos, ultimo_error FROM correo_salida WHERE clave_dedupe = $1`,
      [clave],
    );
    return r.rows[0];
  }

  beforeAll(async () => {
    modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      providers: [
        DatabaseService,
        CorreoSalidaService,
        {
          provide: BrevoService,
          useValue: {
            configurado: () => true,
            enviarDetallado: () => Promise.resolve(resultado),
          },
        },
      ],
    }).compile();
    db = modulo.get(DatabaseService);
    outbox = modulo.get(CorreoSalidaService);
    await limpiar();
  });

  afterAll(async () => {
    await limpiar();
    await modulo.close();
  });

  beforeEach(() => {
    resultado = { enviado: true, permanente: false };
  });

  async function idsDeLaSuite(): Promise<string[]> {
    const r = await db.query<{ id: string }>(
      `SELECT id FROM correo_salida WHERE clave_dedupe LIKE 'zz-rec:%'`,
    );
    return r.rows.map((x) => x.id);
  }

  async function procesarSoloDeLaSuite() {
    const ids = await idsDeLaSuite();
    expect(ids.length).toBeGreaterThan(0);
    return outbox.procesarPendientes(10, ids);
  }

  it('recupera un correo que quedó atascado en "enviando" por una interrupción del proceso', async () => {
    await db.query(
      `INSERT INTO correo_salida (destinatario, asunto, html, clave_dedupe, estado, creado_en)
       VALUES ('zz-rec@example.test','Atascado','<p>x</p>','zz-rec:atascado','enviando', now() - interval '30 minutes')`,
    );
    expect((await fila('zz-rec:atascado')).estado).toBe('enviando');

    const r = await procesarSoloDeLaSuite();
    expect(r.enviados).toBeGreaterThanOrEqual(1);
    expect((await fila('zz-rec:atascado')).estado).toBe('enviado');
  });

  it('no toca un correo que acaba de entrar en "enviando" (envío en curso legítimo)', async () => {
    await db.query(
      `INSERT INTO correo_salida (destinatario, asunto, html, clave_dedupe, estado, creado_en)
       VALUES ('zz-rec@example.test','En curso','<p>x</p>','zz-rec:encurso','enviando', now())`,
    );
    await procesarSoloDeLaSuite();
    expect((await fila('zz-rec:encurso')).estado).toBe('enviando');
  });

  it('guarda el error real del proveedor para poder diagnosticar', async () => {
    resultado = {
      enviado: false,
      permanente: false,
      detalle: 'HTTP 503: servicio temporalmente no disponible',
    };
    const id = await outbox.encolar({
      destinatario: 'zz-rec@example.test',
      asunto: 'Temporal',
      html: '<p>x</p>',
      claveDedupe: 'zz-rec:temporal',
    });
    expect(id).toBe(true);
    await procesarSoloDeLaSuite();
    const f = await fila('zz-rec:temporal');
    expect(f.estado).toBe('pendiente');
    expect(f.intentos).toBe(1);
    expect(f.ultimo_error).toContain('503');
  });

  it('un error permanente no se reintenta indefinidamente', async () => {
    resultado = {
      enviado: false,
      permanente: true,
      detalle: 'HTTP 400: invalid recipient',
    };
    await outbox.encolar({
      destinatario: 'direccion-invalida',
      asunto: 'Permanente',
      html: '<p>x</p>',
      claveDedupe: 'zz-rec:permanente',
    });
    const r = await procesarSoloDeLaSuite();
    expect(r.fallidos).toBe(1);
    const f = await fila('zz-rec:permanente');
    expect(f.estado).toBe('fallido');
    expect(f.intentos).toBe(1);
    expect(f.ultimo_error).toContain('400');
  });
});
