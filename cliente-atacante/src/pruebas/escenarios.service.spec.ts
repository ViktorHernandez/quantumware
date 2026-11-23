import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { EscenariosService } from './escenarios.service';
import { MotorService } from './motor.service';
import { SesionService } from './sesion.service';
import { EvidenciasService } from './evidencias.service';

function servicioCon(permitir: string, modo = 'vulnerable') {
  const config = {
    get: (_c: string, def?: string) => permitir ?? def,
  } as unknown as ConfigService;
  const motor = {
    modoObjetivo: () => Promise.resolve(modo),
  } as unknown as MotorService;
  return new EscenariosService(
    motor,
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

  it('permite PE-01 sin explotación habilitada cuando el objetivo confirma modo corregido', async () => {
    const servicio = servicioCon('false', 'corregido');
    await expect(servicio.ejecutar('PE-01')).rejects.not.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

interface RespuestaSimulada {
  status: number;
  cuerpo: unknown;
}

function servicioPE04(modo: string, respuesta: RespuestaSimulada) {
  const config = {
    get: () => 'true',
  } as unknown as ConfigService;
  const motor = {
    modoObjetivo: () => Promise.resolve(modo),
    baseObjetivo: () => 'http://localhost:3000',
    ejecutar: () =>
      Promise.resolve({
        request: {
          metodo: 'POST',
          url: 'http://localhost:3000/lab/resistencia-autenticacion',
          envioToken: true,
          origenToken: 'cliente',
          tokenEnmascarado: 'eyJ...abc',
          tokenExpiradoAlEnviar: false,
          cabeceras: {},
          cuerpo: { intentos: 12 },
        },
        response: {
          status: respuesta.status,
          tiempoMs: 7,
          cuerpo: respuesta.cuerpo,
        },
      }),
  } as unknown as MotorService;
  const evidencias = {
    guardar: () => ({ archivo: 'simulado.json' }),
  } as unknown as EvidenciasService;
  const sesion = { estado: () => ({}) } as unknown as SesionService;
  return new EscenariosService(motor, sesion, evidencias, config);
}

describe('PE-04 evalúa el comportamiento real del servidor', () => {
  const cuerpoCorregido = {
    modo: 'corregido',
    limiteActivo: true,
    intentosSolicitados: 12,
    intentosProcesados: 5,
    intentosRechazadosPorCredencial: 5,
    bloqueadoEn: 6,
    observacion: 'El mecanismo de protección bloqueó los intentos.',
  };

  it('acepta la respuesta 201 de NestJS cuando la protección bloqueó los intentos', async () => {
    const servicio = servicioPE04('corregido', {
      status: 201,
      cuerpo: cuerpoCorregido,
    });
    const r = await servicio.ejecutar('PE-04', { cantidad: 12 });
    expect(r.cumple).toBe(true);
    expect(r.observacion).toContain('bloqueó a partir del intento 6');
  });

  it('acepta igualmente la respuesta 200 del contrato corregido', async () => {
    const servicio = servicioPE04('corregido', {
      status: 200,
      cuerpo: cuerpoCorregido,
    });
    const r = await servicio.ejecutar('PE-04', { cantidad: 12 });
    expect(r.cumple).toBe(true);
  });

  it('en modo vulnerable exige que se procesen todos los intentos sin bloqueo', async () => {
    const servicio = servicioPE04('vulnerable', {
      status: 200,
      cuerpo: {
        modo: 'vulnerable',
        limiteActivo: false,
        intentosSolicitados: 12,
        intentosProcesados: 12,
        intentosRechazadosPorCredencial: 12,
        bloqueadoEn: null,
      },
    });
    const r = await servicio.ejecutar('PE-04', { cantidad: 12 });
    expect(r.cumple).toBe(true);
    expect(r.observacion).toContain('no bloqueó ninguno');
  });

  it('NO aprueba el modo corregido si el servidor dice limitar pero no bloqueó nada', async () => {
    const servicio = servicioPE04('corregido', {
      status: 200,
      cuerpo: {
        limiteActivo: true,
        intentosSolicitados: 12,
        intentosProcesados: 12,
        bloqueadoEn: null,
      },
    });
    const r = await servicio.ejecutar('PE-04', { cantidad: 12 });
    expect(r.cumple).toBe(false);
  });

  it('NO aprueba si la respuesta no trae el resumen de la simulación', async () => {
    const servicio = servicioPE04('corregido', { status: 500, cuerpo: null });
    const r = await servicio.ejecutar('PE-04', { cantidad: 12 });
    expect(r.cumple).toBe(false);
    expect(r.observacion).toContain('500');
  });
});

interface MotorStub {
  ejecutar: (p: unknown) => Promise<unknown>;
}

function servicioLab(opts: {
  ejecutar: MotorStub['ejecutar'];
  sesion: Partial<SesionService>;
}) {
  const config = { get: () => 'true' } as unknown as ConfigService;
  const motor = {
    modoObjetivo: () => Promise.resolve('corregido'),
    baseObjetivo: () => 'http://localhost:3000',
    ejecutar: opts.ejecutar,
  } as unknown as MotorService;
  const evidencias = {
    guardar: () => ({ archivo: 'simulado.json' }),
  } as unknown as EvidenciasService;
  return new EscenariosService(
    motor,
    opts.sesion as SesionService,
    evidencias,
    config,
  );
}

describe('PA-04 genera un token de laboratorio expirado inmediato', () => {
  it('guarda el token vencido devuelto por el objetivo y lo marca listo', async () => {
    let guardado: string | null = null;
    const expPasado = Math.floor(Date.now() / 1000) - 60;
    const servicio = servicioLab({
      ejecutar: () =>
        Promise.resolve({
          request: {},
          response: {
            status: 200,
            tiempoMs: 4,
            cuerpo: {
              token: 'eyJhbGciOiJFUzI1NiJ9.cuerpo.firma',
              expEpoch: expPasado,
              desfaseSegundos: 60,
              vigente: false,
            },
          },
        }),
      sesion: {
        asegurarCliente: () => Promise.resolve(),
        guardarTokenExpirado: (t: string) => {
          guardado = t;
          return { expiraEn: null, expEpoch: expPasado, expirado: true };
        },
      },
    });
    const r = await servicio.generarTokenExpiradoLab();
    expect(r.ok).toBe(true);
    expect(guardado).toBe('eyJhbGciOiJFUzI1NiJ9.cuerpo.firma');
    expect(r.token).toBe('eyJhbGciOiJFUzI1NiJ9.cuerpo.firma');
    expect(r.mensaje).toContain('expirado');
  });

  it('informa sin romper cuando el objetivo no habilita el laboratorio (404)', async () => {
    const servicio = servicioLab({
      ejecutar: () =>
        Promise.resolve({
          request: {},
          response: { status: 404, tiempoMs: 2, cuerpo: { message: 'no' } },
        }),
      sesion: {
        asegurarCliente: () => Promise.resolve(),
        guardarTokenExpirado: () => ({
          expiraEn: null,
          expEpoch: null,
          expirado: false,
        }),
      },
    });
    const r = await servicio.generarTokenExpiradoLab();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('LAB_TOKEN_EXPIRACION');
  });

  it('no guarda un token si el objetivo devolviera uno todavía vigente', async () => {
    let guardado = false;
    const servicio = servicioLab({
      ejecutar: () =>
        Promise.resolve({
          request: {},
          response: {
            status: 200,
            tiempoMs: 2,
            cuerpo: {
              token: 'eyJ.vigente.firma',
              expEpoch: Math.floor(Date.now() / 1000) + 120,
              desfaseSegundos: 120,
              vigente: true,
            },
          },
        }),
      sesion: {
        asegurarCliente: () => Promise.resolve(),
        guardarTokenExpirado: () => {
          guardado = true;
          return { expiraEn: null, expEpoch: null, expirado: false };
        },
      },
    });
    await expect(servicio.generarTokenExpiradoLab()).rejects.toBeTruthy();
    expect(guardado).toBe(false);
  });
});

describe('PE-03 descubre pedidos de otros clientes de laboratorio', () => {
  const ATACANTE = '00000000-0000-0000-0000-00000000aaaa';
  const OTRO = '00000000-0000-0000-0000-0000000000de';

  it('exige la sesión de administrador para descubrir', async () => {
    const servicio = servicioLab({
      ejecutar: () => Promise.reject(new Error('no debería llamarse')),
      sesion: {
        token: () => null,
        subDe: () => ATACANTE,
      },
    });
    const r = await servicio.descubrirPedidosAjenos();
    expect(r.ok).toBe(false);
    expect(r.pedidos).toHaveLength(0);
    expect(r.mensaje).toContain('administrador');
  });

  it('marca el pedido propio y ofrece los ajenos, ordenados primero', async () => {
    const servicio = servicioLab({
      ejecutar: () =>
        Promise.resolve({
          request: {},
          response: {
            status: 200,
            tiempoMs: 5,
            cuerpo: [
              {
                id: 'id-propio',
                cliente_sub: ATACANTE,
                estado: 'registrado',
                total: '10.00',
                fecha: '2026-11-01T00:00:00Z',
              },
              {
                id: 'id-ajeno-1',
                cliente_sub: OTRO,
                estado: 'enviado',
                total: 55.5,
                fecha: '2026-11-02T00:00:00Z',
              },
            ],
          },
        }),
      sesion: {
        token: (rol: string) => (rol === 'admin' ? 'admin-token' : null),
        subDe: () => ATACANTE,
      },
    });
    const r = await servicio.descubrirPedidosAjenos();
    expect(r.ok).toBe(true);
    const ajenos = r.pedidos.filter((p) => !p.esDelAtacante);
    const propios = r.pedidos.filter((p) => p.esDelAtacante);
    expect(ajenos.map((p) => p.id)).toEqual(['id-ajeno-1']);
    expect(propios.map((p) => p.id)).toEqual(['id-propio']);
    expect(r.pedidos[0].esDelAtacante).toBe(false);
    expect(r.mensaje).toContain('1 pedido');
  });

  it('reporta un objetivo sin resultado cuando el listado falla', async () => {
    const servicio = servicioLab({
      ejecutar: () =>
        Promise.resolve({
          request: {},
          response: { status: 403, tiempoMs: 3, cuerpo: {} },
        }),
      sesion: {
        token: () => 'admin-token',
        subDe: () => ATACANTE,
      },
    });
    const r = await servicio.descubrirPedidosAjenos();
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('403');
  });
});
