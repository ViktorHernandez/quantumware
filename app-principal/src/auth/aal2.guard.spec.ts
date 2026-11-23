import { ConfigService } from '@nestjs/config';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Aal2Guard } from './aal2.guard';
import { FactoresMfaService } from './factores-mfa.service';

function contextoCon(aal: string | null): ExecutionContext {
  const req = { usuario: { sub: 'x', aal } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function guardCon(
  obligatorio: string,
  factores: Partial<FactoresMfaService>,
): Aal2Guard {
  const config = {
    get: (_clave: string, def?: string) => obligatorio ?? def,
  } as unknown as ConfigService;
  return new Aal2Guard(config, factores as FactoresMfaService);
}

describe('Aal2Guard', () => {
  const sinProveedor: Partial<FactoresMfaService> = {
    configurado: () => false,
  };

  it('permite cuando la exigencia está apagada y no hay proveedor, aunque la sesión sea aal1', async () => {
    const guard = guardCon('false', sinProveedor);
    await expect(guard.canActivate(contextoCon('aal1'))).resolves.toBe(true);
  });

  it('rechaza una sesión aal1 cuando la exigencia está encendida y no hay proveedor', async () => {
    const guard = guardCon('true', sinProveedor);
    await expect(guard.canActivate(contextoCon('aal1'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permite una sesión aal2 sin consultar al proveedor', async () => {
    const guard = guardCon('true', {
      configurado: () => true,
      tieneFactorVerificado: () =>
        Promise.reject(new Error('no debería consultarse')),
    });
    await expect(guard.canActivate(contextoCon('aal2'))).resolves.toBe(true);
  });

  it('rechaza una sesión aal1 de una cuenta con factor verificado', async () => {
    const guard = guardCon('false', {
      configurado: () => true,
      tieneFactorVerificado: () => Promise.resolve(true),
    });
    await expect(guard.canActivate(contextoCon('aal1'))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
