import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { MotorService } from './motor.service';
import { SesionService } from './sesion.service';

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function jwt(exp: number): string {
  return `${b64url({ alg: 'none' })}.${b64url({ sub: 'x', exp })}.firma`;
}

function motorCon(valores: Record<string, string>) {
  const config = {
    get: (clave: string, def?: string) => valores[clave] ?? def,
  } as unknown as ConfigService;
  const sesion = {
    token: () => jwt(Math.floor(Date.now() / 1000) + 3600),
  } as unknown as SesionService;
  return new MotorService(config, sesion);
}

describe('MotorService', () => {
  describe('PA-04 token expirado', () => {
    const motor = motorCon({ TARGET_BASE_URL: 'http://localhost:3000' });

    it('rechaza si no se proporciona un token manual', async () => {
      await expect(
        motor.ejecutar({
          metodo: 'GET',
          ruta: '/pedidos',
          origenToken: 'expirado',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si el token proporcionado no está expirado', async () => {
      const vigente = jwt(Math.floor(Date.now() / 1000) + 3600);
      await expect(
        motor.ejecutar({
          metodo: 'GET',
          ruta: '/pedidos',
          origenToken: 'expirado',
          tokenManual: vigente,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta y marca como expirado un token realmente vencido', async () => {
      const vencido = jwt(Math.floor(Date.now() / 1000) - 3600);
      const fetchOriginal = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        status: 401,
        text: () => Promise.resolve('{"statusCode":401}'),
      });
      try {
        const r = await motor.ejecutar({
          metodo: 'GET',
          ruta: '/pedidos',
          origenToken: 'expirado',
          tokenManual: vencido,
        });
        expect(r.request.tokenExpiradoAlEnviar).toBe(true);
        expect(r.response.status).toBe(401);
      } finally {
        global.fetch = fetchOriginal;
      }
    });
  });

  describe('restricción de destino', () => {
    it('rechaza direcciones privadas o de metadatos', async () => {
      const motor = motorCon({
        NODE_ENV: 'production',
        TARGET_BASE_URL: 'https://169.254.169.254',
        TARGET_ALLOWLIST: '169.254.169.254',
      });
      await expect(
        motor.ejecutar({
          metodo: 'GET',
          ruta: '/latest/meta-data',
          origenToken: 'ninguno',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza HTTP fuera de localhost', async () => {
      const motor = motorCon({
        NODE_ENV: 'production',
        TARGET_BASE_URL: 'http://quantumware-app.onrender.com',
        TARGET_ALLOWLIST: 'quantumware-app.onrender.com',
      });
      await expect(
        motor.ejecutar({
          metodo: 'GET',
          ruta: '/pedidos',
          origenToken: 'ninguno',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('precondición de sesión capturada', () => {
    function motorSinSesion() {
      const config = {
        get: (clave: string, def?: string) =>
          ({ TARGET_BASE_URL: 'http://localhost:3000' })[clave] ?? def,
      } as unknown as ConfigService;
      const sesion = { token: () => null } as unknown as SesionService;
      return new MotorService(config, sesion);
    }

    it('no ejecuta un escenario de administrador sin sesión admin capturada', async () => {
      await expect(
        motorSinSesion().ejecutar({
          metodo: 'POST',
          ruta: '/productos',
          origenToken: 'admin',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no ejecuta un escenario de cliente ni el token alterado sin sesión de cliente', async () => {
      await expect(
        motorSinSesion().ejecutar({
          metodo: 'GET',
          ruta: '/pedidos',
          origenToken: 'cliente',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        motorSinSesion().ejecutar({
          metodo: 'GET',
          ruta: '/pedidos',
          origenToken: 'alterado',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
