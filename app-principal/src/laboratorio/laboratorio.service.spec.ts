import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LaboratorioService } from './laboratorio.service';

function servicio(modo: string) {
  const config = {
    get: (_clave: string, def?: string) => modo ?? def,
  } as unknown as ConfigService;
  return new LaboratorioService(config);
}

describe('LaboratorioService — resistencia a intentos de autenticación', () => {
  it('modo corregido: bloquea tras el umbral y no procesa todos los intentos', () => {
    const r = servicio('corregido').resistenciaAutenticacion(12);
    expect(r.limiteActivo).toBe(true);
    expect(r.bloqueadoEn).not.toBeNull();
    expect(r.intentosProcesados).toBeLessThan(12);
    expect(r.intentosProcesados).toBe(5);
  });

  it('modo vulnerable: sin límite, procesa todos los intentos solicitados', () => {
    const r = servicio('vulnerable').resistenciaAutenticacion(12);
    expect(r.limiteActivo).toBe(false);
    expect(r.bloqueadoEn).toBeNull();
    expect(r.intentosProcesados).toBe(12);
  });

  it('rechaza una cantidad fuera del límite seguro (0 o mayor que 20)', () => {
    expect(() => servicio('corregido').resistenciaAutenticacion(0)).toThrow(
      BadRequestException,
    );
    expect(() => servicio('corregido').resistenciaAutenticacion(21)).toThrow(
      BadRequestException,
    );
  });

  it('por debajo del umbral no bloquea', () => {
    const r = servicio('corregido').resistenciaAutenticacion(3);
    expect(r.bloqueadoEn).toBeNull();
    expect(r.intentosProcesados).toBe(3);
  });
});
