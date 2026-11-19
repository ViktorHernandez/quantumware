import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MotorService, type ResultadoSolicitud } from './motor.service';
import { SesionService } from './sesion.service';
import { EvidenciasService } from './evidencias.service';
import {
  ESCENARIOS,
  productoDePrueba,
  type DefinicionEscenario,
} from './escenarios';

export interface OpcionesEscenario {
  tokenManual?: string;
  cantidad?: number;
  q?: string;
  pedidoObjetivo?: string;
}

export interface ResultadoEscenario {
  escenario: DefinicionEscenario;
  modoBackend: string;
  statusEsperado: number | null;
  esperado: string;
  resultado: ResultadoSolicitud;
  cumple: boolean | null;
  observacion: string;
  restablecimiento?: string;
  evidencia: string;
}

@Injectable()
export class EscenariosService {
  constructor(
    private readonly motor: MotorService,
    private readonly sesion: SesionService,
    private readonly evidencias: EvidenciasService,
    private readonly config: ConfigService,
  ) {}

  permitirExplotacion(): boolean {
    return (
      this.config.get<string>('PERMITIR_EXPLOTACION', 'true').toLowerCase() !==
      'false'
    );
  }

  listar(): DefinicionEscenario[] {
    return ESCENARIOS;
  }

  private async idProductoDisponible(): Promise<string> {
    const lista = await this.motor.ejecutar({
      metodo: 'GET',
      ruta: '/productos',
      origenToken: 'cliente',
    });
    const cuerpo = lista.response.cuerpo;
    const arreglo = Array.isArray(cuerpo)
      ? cuerpo
      : (cuerpo as { items?: unknown[] })?.items;
    if (Array.isArray(arreglo) && arreglo.length > 0) {
      return (arreglo[0] as { id: string }).id;
    }
    throw new BadRequestException(
      'No hay productos en el catálogo para construir el pedido de prueba.',
    );
  }

  private expectativa(
    def: DefinicionEscenario,
    modo: string,
  ): { status: number | null; texto: string } {
    switch (def.id) {
      case 'PF-01':
        return { status: 200, texto: def.esperadoBase };
      case 'PE-01':
        return {
          status: 200,
          texto:
            modo === 'vulnerable'
              ? 'Vulnerable: 200 con más registros que la búsqueda legítima.'
              : 'Corregido: 200 sin registros adicionales.',
        };
      case 'PE-02':
        return {
          status: modo === 'vulnerable' ? 201 : 400,
          texto:
            modo === 'vulnerable'
              ? 'Vulnerable: 201 con la cantidad fuera de límite.'
              : 'Corregido: 400 y el pedido no se registra.',
        };
      case 'PE-03':
        return {
          status: modo === 'vulnerable' ? 200 : 403,
          texto:
            modo === 'vulnerable'
              ? 'Vulnerable: 200 y expone el pedido de otro cliente.'
              : 'Corregido: 403 y no revela el pedido ajeno.',
        };
      case 'PE-04':
        return {
          status: 200,
          texto:
            modo === 'vulnerable'
              ? 'Vulnerable: procesa todos los intentos sin bloqueo.'
              : 'Corregido: bloquea los intentos a partir del umbral.',
        };
      case 'PA-01':
        return { status: 201, texto: def.esperadoBase };
      case 'PA-05':
        return { status: 403, texto: def.esperadoBase };
      default:
        return { status: 401, texto: def.esperadoBase };
    }
  }

  private describirObservado(
    status: number,
    envioToken: boolean,
    statusEsperado: number | null,
    cumple: boolean | null,
  ): string {
    const conToken = envioToken ? 'con token' : 'sin token';
    const base = `El servidor respondió HTTP ${status} a una solicitud ${conToken}`;
    if (statusEsperado === null) {
      return `${base}.`;
    }
    if (cumple) {
      return `${base}, que coincide con el resultado esperado (${statusEsperado}).`;
    }
    return `${base}; se esperaba ${statusEsperado}, por lo que el escenario no se cumple.`;
  }

  async ejecutar(
    id: string,
    opciones: OpcionesEscenario = {},
  ): Promise<ResultadoEscenario> {
    const def = ESCENARIOS.find((e) => e.id === id);
    if (!def) {
      throw new NotFoundException('Escenario no definido.');
    }

    const modo = await this.motor.modoObjetivo();
    const demostracionSeguraPublica =
      !this.permitirExplotacion() &&
      modo === 'corregido' &&
      (id === 'PE-01' || id === 'PE-02');

    if (
      def.tipo === 'explotacion' &&
      !this.permitirExplotacion() &&
      !demostracionSeguraPublica
    ) {
      throw new ForbiddenException(
        'Este escenario requiere el laboratorio local. En el despliegue solo se permiten PE-01 y PE-02 contra el objetivo autorizado cuando confirma modo corregido.',
      );
    }

    const { status: statusEsperado, texto: esperado } = this.expectativa(
      def,
      modo,
    );

    let ruta = def.ruta;
    let cuerpo: unknown;

    if (def.id === 'PE-02') {
      const productoId = await this.idProductoDisponible();
      cuerpo = {
        items: [
          { producto_id: productoId, cantidad: opciones.cantidad ?? 99999 },
        ],
      };
    } else if (def.id === 'PA-01') {
      cuerpo = productoDePrueba();
    } else if (def.id === 'PF-01' && opciones.q) {
      ruta = `/productos/buscar?q=${encodeURIComponent(opciones.q)}`;
    } else if (def.id === 'PE-03') {
      const objetivo = (opciones.pedidoObjetivo ?? '').trim();
      if (!/^[0-9a-fA-F-]{36}$/.test(objetivo)) {
        throw new BadRequestException(
          'PE-03 requiere el identificador (UUID) de un pedido que pertenezca a otro cliente de laboratorio. Indícalo antes de ejecutar el escenario; no se envía una ruta incompleta.',
        );
      }
      ruta = `/pedidos/${objetivo}`;
    } else if (def.id === 'PE-04') {
      cuerpo = { intentos: opciones.cantidad ?? 12 };
    }

    const resultado = await this.motor.ejecutar({
      metodo: def.metodo,
      ruta,
      origenToken: def.origenToken,
      tokenManual: opciones.tokenManual,
      cuerpo,
    });

    let cumple: boolean | null =
      statusEsperado !== null
        ? resultado.response.status === statusEsperado
        : null;
    let observacion = this.describirObservado(
      resultado.response.status,
      resultado.request.envioToken,
      statusEsperado,
      cumple,
    );
    let restablecimiento: string | undefined = def.restablecimiento;

    if (def.id === 'PE-01') {
      const c = resultado.response.cuerpo;
      const n = Array.isArray(c) ? c.length : 0;
      if (modo === 'vulnerable') {
        cumple = resultado.response.status === 200 && n > 1;
        observacion = `La respuesta contiene ${n} registro(s); con el catálogo ficticio la inyección devuelve más de uno.`;
      } else {
        cumple = resultado.response.status === 200 && n <= 1;
        observacion = `La respuesta contiene ${n} registro(s): la consulta parametrizada trata la carga como texto literal.`;
      }
    }

    if (def.id === 'PE-04') {
      const c = resultado.response.cuerpo as {
        limiteActivo?: boolean;
        bloqueadoEn?: number | null;
        intentosProcesados?: number;
        observacion?: string;
      } | null;
      const ok200 = resultado.response.status === 200 && c !== null;
      if (modo === 'vulnerable') {
        cumple =
          ok200 &&
          c?.limiteActivo === false &&
          (c?.bloqueadoEn ?? null) === null;
      } else {
        cumple =
          ok200 &&
          c?.limiteActivo === true &&
          typeof c?.bloqueadoEn === 'number';
      }
      observacion =
        c?.observacion ??
        'No se recibió el resumen de la simulación de intentos.';
    }

    if (def.id === 'PA-04' && resultado.request.tokenEnmascarado) {
      if (resultado.request.tokenExpiradoAlEnviar === false) {
        observacion =
          'El token enviado aún no estaba vencido, por lo que no demuestra la expiración. Reduce la vigencia del token en Supabase, espera a que el token capturado expire y repite, o pega un token ya expirado.';
        cumple = null;
      } else if (resultado.request.tokenExpiradoAlEnviar === true) {
        observacion =
          'Se envió un token auténtico con la expiración ya vencida y el servidor lo rechazó.';
      }
    }

    if (def.id === 'PA-04' && !resultado.request.tokenEnmascarado) {
      observacion =
        'No hay token para PA-04. Inicia sesión como cliente (y espera a que expire) o pega un token expirado.';
      cumple = null;
    }

    if (def.id === 'PA-01' && resultado.response.status === 201) {
      const creado = resultado.response.cuerpo as { id?: string } | null;
      if (creado?.id) {
        const borrado = await this.motor.ejecutar({
          metodo: 'DELETE',
          ruta: `/productos/${creado.id}`,
          origenToken: 'admin',
        });
        restablecimiento = `Producto de prueba eliminado (respuesta ${borrado.response.status}).`;
      }
    }

    const evidencia = this.evidencias.guardar(def.id, {
      escenario: def.id,
      titulo: def.titulo,
      ejecutadoEn: new Date().toISOString(),
      objetivo: this.motor.baseObjetivo(),
      vulnMode: modo,
      request: resultado.request,
      response: resultado.response,
      statusEsperado,
      esperado,
      cumple,
      observacion,
      restablecimiento: restablecimiento ?? null,
      sesiones: this.sesion.estado(),
    });

    return {
      escenario: def,
      modoBackend: modo,
      statusEsperado,
      esperado,
      resultado,
      cumple,
      observacion,
      restablecimiento,
      evidencia,
    };
  }
}
