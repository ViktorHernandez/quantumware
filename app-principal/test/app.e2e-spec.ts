jest.mock('jose', () => ({
  createRemoteJWKSet: () => () => ({}),
  jwtVerify: () =>
    Promise.reject(new Error('token no verificable en el entorno de prueba')),
}));

import { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/http-exception.filter';

describe('app-principal (e2e)', () => {
  let app: INestApplication;
  const servidor = () => app.getHttpServer() as Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /salud responde con el estado del servicio', () => {
    return request(servidor())
      .get('/salud')
      .expect(200)
      .expect((res) => {
        const cuerpo = res.body as { servicio?: string };
        if (cuerpo.servicio !== 'app-principal') {
          throw new Error('servicio inesperado');
        }
      });
  });

  it('GET /productos sin token responde 401', () => {
    return request(servidor()).get('/productos').expect(401);
  });

  it('POST /pedidos sin token responde 401', () => {
    return request(servidor()).post('/pedidos').send({ items: [] }).expect(401);
  });
});
