import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Aal2Guard } from '../src/auth/aal2.guard';
import { FactoresMfaService } from '../src/auth/factores-mfa.service';

function contexto(usuario: Record<string, unknown> | undefined) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ usuario }),
    }),
  } as unknown as ExecutionContext;
}

function configCon(valores: Record<string, string>): ConfigService {
  return {
    get: (clave: string, defecto?: string) => valores[clave] ?? defecto,
  } as unknown as ConfigService;
}

function factoresSimulados(opciones: {
  configurado: boolean;
  tieneFactor?: boolean;
  falla?: boolean;
}): FactoresMfaService {
  return {
    configurado: () => opciones.configurado,
    tieneFactorVerificado: () => {
      if (opciones.falla) {
        return Promise.reject(new Error('fallo simulado'));
      }
      return Promise.resolve(Boolean(opciones.tieneFactor));
    },
    invalidar: () => undefined,
  } as unknown as FactoresMfaService;
}

const SUB = '00000000-0000-0000-0000-00000000aa15';

describe('Aal2Guard (estado real de MFA por cuenta)', () => {
  it('una sesión con claim aal2 pasa sin consultar factores', async () => {
    const guard = new Aal2Guard(
      configCon({}),
      factoresSimulados({ configurado: true, falla: true }),
    );
    await expect(
      guard.canActivate(contexto({ sub: SUB, aal: 'aal2' })),
    ).resolves.toBe(true);
  });

  it('una sesión aal1 de una cuenta CON factor verificado se bloquea (403)', async () => {
    const guard = new Aal2Guard(
      configCon({}),
      factoresSimulados({ configurado: true, tieneFactor: true }),
    );
    await expect(
      guard.canActivate(contexto({ sub: SUB, aal: 'aal1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('una sesión aal1 de una cuenta SIN factores pasa (aal1 es su máximo nivel)', async () => {
    const guard = new Aal2Guard(
      configCon({}),
      factoresSimulados({ configurado: true, tieneFactor: false }),
    );
    await expect(
      guard.canActivate(contexto({ sub: SUB, aal: 'aal1' })),
    ).resolves.toBe(true);
  });

  it('si la consulta de factores falla, la operación sensible se bloquea (fail-closed)', async () => {
    const guard = new Aal2Guard(
      configCon({}),
      factoresSimulados({ configurado: true, falla: true }),
    );
    await expect(
      guard.canActivate(contexto({ sub: SUB, aal: 'aal1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sin clave de servicio respeta MFA_ADMIN_OBLIGATORIO=true (403)', async () => {
    const guard = new Aal2Guard(
      configCon({ MFA_ADMIN_OBLIGATORIO: 'true' }),
      factoresSimulados({ configurado: false }),
    );
    await expect(
      guard.canActivate(contexto({ sub: SUB, aal: 'aal1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sin clave de servicio y sin obligatoriedad, permite la operación', async () => {
    const guard = new Aal2Guard(
      configCon({ MFA_ADMIN_OBLIGATORIO: 'false' }),
      factoresSimulados({ configurado: false }),
    );
    await expect(
      guard.canActivate(contexto({ sub: SUB, aal: 'aal1' })),
    ).resolves.toBe(true);
  });

  it('sin usuario autenticado en la petición se bloquea', async () => {
    const guard = new Aal2Guard(
      configCon({}),
      factoresSimulados({ configurado: true }),
    );
    await expect(guard.canActivate(contexto(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
