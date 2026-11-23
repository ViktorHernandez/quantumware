jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: () =>
        Promise.resolve({
          data: { session: null },
          error: { message: 'sin credenciales de prueba' },
        }),
    },
  }),
}));

import { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('cliente-atacante (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/config devuelve la lista de escenarios', () => {
    return request(app.getHttpServer() as Server)
      .get('/api/config')
      .expect(200)
      .expect((res) => {
        const cuerpo = res.body as { escenarios?: unknown };
        if (!Array.isArray(cuerpo.escenarios)) {
          throw new Error('escenarios ausente');
        }
        const escenarios = cuerpo.escenarios as Array<{ id?: unknown }>;

        if (escenarios.length === 0) {
          throw new Error('el endpoint no devolvió ningún escenario');
        }

        const identificadores = escenarios.map((escenario) => escenario?.id);

        if (
          identificadores.some(
            (id) => typeof id !== 'string' || id.trim().length === 0,
          )
        ) {
          throw new Error(
            'uno o más escenarios no tienen un identificador válido',
          );
        }

        if (new Set(identificadores).size !== identificadores.length) {
          throw new Error('hay identificadores de escenarios duplicados');
        }
      });
  });
});
