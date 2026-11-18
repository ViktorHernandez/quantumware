import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { EscenariosService } from './escenarios.service';
import { MotorService } from './motor.service';
import { SesionService } from './sesion.service';
import { EvidenciasService } from './evidencias.service';

function servicioCon(permitir: string) {
  const config = {
    get: (_c: string, def?: string) => permitir ?? def,
  } as unknown as ConfigService;
  return new EscenariosService(
    {} as MotorService,
    {} as SesionService,
    {} as EvidenciasService,
    config,
  );
}

describe('EscenariosService gateo de explotación', () => {
  it('permitirExplotacion refleja la configuración', () => {
    expect(servicioCon('true').permitirExplotacion()).toBe(true);
    expect(servicioCon('false').permitirExplotacion()).toBe(false);
  });

  it('rechaza PE-01 cuando la explotación está deshabilitada', async () => {
    await expect(servicioCon('false').ejecutar('PE-01')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza PE-02 cuando la explotación está deshabilitada', async () => {
    await expect(servicioCon('false').ejecutar('PE-02')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
