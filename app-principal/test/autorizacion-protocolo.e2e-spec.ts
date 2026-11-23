import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import {
  Body,
  Controller,
  Get,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import request from 'supertest';
import { AuthGuard } from '../src/auth/auth.guard';
import { JwtVerifierService } from '../src/auth/jwt-verifier.service';
import { LabIdentidadService } from '../src/auth/lab-identidad.service';
import { Roles } from '../src/auth/roles.decorator';
import { RolesGuard } from '../src/auth/roles.guard';
import { RolesService } from '../src/auth/roles.service';

const EMISOR = 'https://proyecto-de-prueba.supabase.co/auth/v1';
const DESTINATARIO = 'authenticated';
const ADMIN_SUB = '00000000-0000-0000-0000-0000000000a1';
const CLIENTE_SUB = '00000000-0000-0000-0000-0000000000c1';

@Controller('ruta-protegida')
@UseGuards(AuthGuard)
class RutaProtegidaController {
  @Get('pedidos')
  pedidos() {
    return { items: [] };
  }

  @Post('productos')
  @UseGuards(RolesGuard)
  @Roles('admin')
  crear(@Body() cuerpo: Record<string, unknown>) {
    return { creado: true, nombre: cuerpo.nombre };
  }
}

describe('Escenarios obligatorios de autorización (PA-01 a PA-05)', () => {
  let app: INestApplication;
  const servidor = () => app.getHttpServer() as Server;
  let jwksServer: Server;
  let firmar: (
    claims: Record<string, unknown>,
    exp: string | number,
  ) => Promise<string>;
  let tokenAjeno: string;
  let claveFirma: Parameters<typeof exportJWK>[0];

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    claveFirma = privateKey;
    const jwk = {
      ...(await exportJWK(publicKey)),
      kid: 'clave-de-prueba-1',
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
    process.env.SUPABASE_ISSUER = EMISOR;
    process.env.SUPABASE_AUDIENCE = DESTINATARIO;

    firmar = (claims, exp) =>
      new SignJWT({ aal: 'aal1', ...claims })
        .setProtectedHeader({ alg: 'ES256', kid: 'clave-de-prueba-1' })
        .setIssuer(EMISOR)
        .setAudience(DESTINATARIO)
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(privateKey);

    const otro = await generateKeyPair('ES256');
    tokenAjeno = await new SignJWT({ sub: ADMIN_SUB, aal: 'aal1' })
      .setProtectedHeader({ alg: 'ES256', kid: 'clave-de-prueba-1' })
      .setIssuer(EMISOR)
      .setAudience(DESTINATARIO)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otro.privateKey);

    const modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
      controllers: [RutaProtegidaController],
      providers: [
        JwtVerifierService,
        LabIdentidadService,
        {
          provide: RolesService,
          useValue: {
            rolDe: (sub: string) =>
              Promise.resolve(sub === ADMIN_SUB ? 'admin' : 'cliente'),
          },
        },
      ],
    }).compile();

    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await new Promise<void>((listo) => jwksServer.close(() => listo()));
  });

  it('PA-01: token válido con permisos suficientes permite la operación (201)', async () => {
    const token = await firmar({ sub: ADMIN_SUB }, '1h');
    const r = await request(servidor())
      .post('/ruta-protegida/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'ZZ_AUTZ_PRODUCTO' });
    expect(r.status).toBe(201);
    expect((r.body as { creado?: boolean }).creado).toBe(true);
  });

  it('PA-02: sin token el servidor rechaza la solicitud (401)', async () => {
    const r = await request(servidor()).get('/ruta-protegida/pedidos');
    expect(r.status).toBe(401);
  });

  it('PA-03: un token alterado se rechaza (401), la firma no valida', async () => {
    const token = await firmar({ sub: ADMIN_SUB }, '1h');
    const partes = token.split('.');
    const cargaAlterada = Buffer.from(
      JSON.stringify({
        sub: ADMIN_SUB,
        iss: EMISOR,
        aud: DESTINATARIO,
        exp: Math.floor(Date.now() / 1000) + 3600,
        rol: 'admin',
      }),
    ).toString('base64url');
    const alterado = `${partes[0]}.${cargaAlterada}.${partes[2]}`;

    const r = await request(servidor())
      .get('/ruta-protegida/pedidos')
      .set('Authorization', `Bearer ${alterado}`);
    expect(r.status).toBe(401);
  });

  it('PA-04: un token expirado se rechaza (401)', async () => {
    const token = await firmar(
      { sub: ADMIN_SUB },
      Math.floor(Date.now() / 1000) - 60,
    );
    const r = await request(servidor())
      .get('/ruta-protegida/pedidos')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
  });

  it('PA-05: un token válido sin los permisos requeridos se rechaza (403)', async () => {
    const token = await firmar({ sub: CLIENTE_SUB }, '1h');
    const r = await request(servidor())
      .post('/ruta-protegida/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'ZZ_AUTZ_PRODUCTO' });
    expect(r.status).toBe(403);
  });

  it('el mismo token válido sin permisos SÍ accede a una ruta que solo exige autenticación (200)', async () => {
    const token = await firmar({ sub: CLIENTE_SUB }, '1h');
    const r = await request(servidor())
      .get('/ruta-protegida/pedidos')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('un token firmado con otra clave se rechaza: decodificar no es verificar (401)', async () => {
    const r = await request(servidor())
      .get('/ruta-protegida/pedidos')
      .set('Authorization', `Bearer ${tokenAjeno}`);
    expect(r.status).toBe(401);
  });

  it('un token con emisor distinto se rechaza aunque la firma sea válida (401)', async () => {
    const token = await new SignJWT({ sub: ADMIN_SUB })
      .setProtectedHeader({ alg: 'ES256', kid: 'clave-de-prueba-1' })
      .setIssuer('https://emisor-no-autorizado.example/auth/v1')
      .setAudience(DESTINATARIO)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(claveFirma);
    const r = await request(servidor())
      .get('/ruta-protegida/pedidos')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
  });

  it('un token con otro destinatario se rechaza aunque la firma sea válida (401)', async () => {
    const token = await new SignJWT({ sub: ADMIN_SUB })
      .setProtectedHeader({ alg: 'ES256', kid: 'clave-de-prueba-1' })
      .setIssuer(EMISOR)
      .setAudience('otra-aplicacion')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(claveFirma);
    const r = await request(servidor())
      .get('/ruta-protegida/pedidos')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
  });

  it('el cuerpo de los rechazos no revela el token ni datos internos', async () => {
    const token = await firmar({ sub: CLIENTE_SUB }, '1h');
    const r = await request(servidor())
      .post('/ruta-protegida/productos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'ZZ_AUTZ_PRODUCTO' });
    const cuerpo = JSON.stringify(r.body);
    expect(cuerpo).not.toContain(token);
    expect(cuerpo).not.toContain(CLIENTE_SUB);
    expect(cuerpo).not.toContain('user_roles');
  });
});
