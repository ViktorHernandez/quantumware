import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import request from 'supertest';
import { AuthGuard } from '../src/auth/auth.guard';
import { JwtVerifierService } from '../src/auth/jwt-verifier.service';
import { LabIdentidadService } from '../src/auth/lab-identidad.service';
import { LaboratorioController } from '../src/laboratorio/laboratorio.controller';
import { LaboratorioService } from '../src/laboratorio/laboratorio.service';

const EMISOR = 'https://proyecto-de-prueba.supabase.co/auth/v1';
const DESTINATARIO = 'authenticated';
const CLIENTE_SUB = '00000000-0000-0000-0000-0000000000c1';

@Controller('lab-protegida')
@UseGuards(AuthGuard)
class RutaLabController {
  @Get('pedidos')
  pedidos() {
    return { items: [] };
  }
}

interface TokenRespuesta {
  token: string;
  proposito: string;
  expEpoch: number;
  desfaseSegundos: number;
  vigente: boolean;
}

describe('Token de laboratorio para PA-04 (expiración)', () => {
  let app: INestApplication;
  const servidor = () => app.getHttpServer() as Server;
  let jwksServer: Server;
  let tokenRealValido: string;

  async function construir(
    labActivo: boolean,
    vigenteDemo = labActivo,
  ): Promise<INestApplication> {
    process.env.NODE_ENV = 'production';
    process.env.LAB_TOKEN_EXPIRACION = labActivo ? 'true' : 'false';
    process.env.LAB_TOKEN_VIGENTE_DEMO = vigenteDemo ? 'true' : 'false';
    process.env.SUPABASE_ISSUER = EMISOR;
    process.env.SUPABASE_AUDIENCE = DESTINATARIO;
    const modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [RutaLabController, LaboratorioController],
      providers: [JwtVerifierService, LabIdentidadService, LaboratorioService],
    }).compile();
    const instancia = modulo.createNestApplication();
    await instancia.init();
    return instancia;
  }

  beforeAll(async () => {
    const remota = await generateKeyPair('ES256');
    const jwk = {
      ...(await exportJWK(remota.publicKey)),
      kid: 'clave-remota-1',
      alg: 'ES256',
      use: 'sig',
    };
    jwksServer = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((listo) =>
      jwksServer.listen(0, '127.0.0.1', listo),
    );
    const puerto = (jwksServer.address() as AddressInfo).port;
    process.env.SUPABASE_JWKS_URL = `http://127.0.0.1:${puerto}/keys`;

    tokenRealValido = await new SignJWT({ aal: 'aal1' })
      .setProtectedHeader({ alg: 'ES256', kid: 'clave-remota-1' })
      .setSubject(CLIENTE_SUB)
      .setIssuer(EMISOR)
      .setAudience(DESTINATARIO)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(remota.privateKey);

    app = await construir(true);
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((listo) => jwksServer.close(() => listo()));
  });

  it('emite un token de laboratorio vigente que el servidor acepta (control positivo, 200)', async () => {
    const r = await request(servidor())
      .post('/lab/token-expiracion')
      .set('Authorization', `Bearer ${tokenRealValido}`)
      .send({ proposito: 'vigente', margenSegundos: 120 });
    expect(r.status).toBe(200);
    const cuerpo = r.body as TokenRespuesta;
    expect(cuerpo.vigente).toBe(true);

    const acceso = await request(servidor())
      .get('/lab-protegida/pedidos')
      .set('Authorization', `Bearer ${cuerpo.token}`);
    expect(acceso.status).toBe(200);
  });

  it('emite un token de laboratorio ya expirado y el servidor lo rechaza por expiración (401)', async () => {
    const r = await request(servidor())
      .post('/lab/token-expiracion')
      .set('Authorization', `Bearer ${tokenRealValido}`)
      .send({ proposito: 'expirado', margenSegundos: 60 });
    expect(r.status).toBe(200);
    const cuerpo = r.body as TokenRespuesta;
    expect(cuerpo.vigente).toBe(false);
    expect(cuerpo.expEpoch).toBeLessThan(Math.floor(Date.now() / 1000));

    const acceso = await request(servidor())
      .get('/lab-protegida/pedidos')
      .set('Authorization', `Bearer ${cuerpo.token}`);
    expect(acceso.status).toBe(401);
  });

  it('un token con la clave de laboratorio pero emisor equivocado se rechaza (401)', async () => {
    const lab = app.get(LabIdentidadService);
    const clave = await lab.clavePublica();
    expect(clave).toBeDefined();
    const r = await request(servidor())
      .post('/lab/token-expiracion')
      .set('Authorization', `Bearer ${tokenRealValido}`)
      .send({ proposito: 'vigente', margenSegundos: 120 });
    const token = (r.body as TokenRespuesta).token;
    const partes = token.split('.');
    const cargaAlterada = Buffer.from(
      JSON.stringify({
        sub: CLIENTE_SUB,
        iss: 'https://otro-emisor.example/auth/v1',
        aud: DESTINATARIO,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    const alterado = `${partes[0]}.${cargaAlterada}.${partes[2]}`;
    const acceso = await request(servidor())
      .get('/lab-protegida/pedidos')
      .set('Authorization', `Bearer ${alterado}`);
    expect(acceso.status).toBe(401);
  });

  it('el token real de Supabase sigue siendo aceptado con el laboratorio activo (200)', async () => {
    const acceso = await request(servidor())
      .get('/lab-protegida/pedidos')
      .set('Authorization', `Bearer ${tokenRealValido}`);
    expect(acceso.status).toBe(200);
  });

  describe('en un servidor público (solo expirados)', () => {
    let appPublico: INestApplication;
    const servidorPublico = () => appPublico.getHttpServer() as Server;

    beforeAll(async () => {
      appPublico = await construir(true, false);
    });
    afterAll(async () => {
      await appPublico.close();
      process.env.LAB_TOKEN_EXPIRACION = 'true';
      process.env.LAB_TOKEN_VIGENTE_DEMO = 'true';
    });

    it('con NODE_ENV=production y el indicador explícito, emite un token expirado y el servidor lo rechaza (401)', async () => {
      const r = await request(servidorPublico())
        .post('/lab/token-expiracion')
        .set('Authorization', `Bearer ${tokenRealValido}`)
        .send({ proposito: 'expirado', margenSegundos: 60 });
      expect(r.status).toBe(200);
      const cuerpo = r.body as TokenRespuesta;
      expect(cuerpo.vigente).toBe(false);
      const acceso = await request(servidorPublico())
        .get('/lab-protegida/pedidos')
        .set('Authorization', `Bearer ${cuerpo.token}`);
      expect(acceso.status).toBe(401);
    });

    it('rechaza la emisión de tokens vigentes cuando el indicador de demostración está apagado (403)', async () => {
      const r = await request(servidorPublico())
        .post('/lab/token-expiracion')
        .set('Authorization', `Bearer ${tokenRealValido}`)
        .send({ proposito: 'vigente', margenSegundos: 120 });
      expect(r.status).toBe(403);
    });
  });

  describe('con el laboratorio deshabilitado', () => {
    let appOff: INestApplication;
    const servidorOff = () => appOff.getHttpServer() as Server;

    beforeAll(async () => {
      appOff = await construir(false);
    });
    afterAll(async () => {
      await appOff.close();
      process.env.LAB_TOKEN_EXPIRACION = 'true';
    });

    it('la emisión de tokens de laboratorio no está disponible (404)', async () => {
      const r = await request(servidorOff())
        .post('/lab/token-expiracion')
        .set('Authorization', `Bearer ${tokenRealValido}`)
        .send({ proposito: 'expirado' });
      expect(r.status).toBe(404);
    });

    it('un token firmado con la clave de laboratorio no es aceptado (401)', async () => {
      const labActivo = app.get(LabIdentidadService);
      const emitido = await labActivo.emitir('vigente', 120);
      const acceso = await request(servidorOff())
        .get('/lab-protegida/pedidos')
        .set('Authorization', `Bearer ${emitido.token}`);
      expect(acceso.status).toBe(401);
    });
  });
});
