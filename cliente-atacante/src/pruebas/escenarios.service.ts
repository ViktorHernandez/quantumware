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

  async generarTokenExpiradoLab(): Promise<{
    ok: boolean;
    status: number;
    token: string | null;
    expiraEn: string | null;
    expEpoch: number | null;
    desfaseSegundos: number | null;
    mensaje: string;
  }> {
    await this.sesion.asegurarCliente();
    const r = await this.motor.ejecutar({
      metodo: 'POST',
      ruta: '/lab/token-expiracion',
      origenToken: 'cliente',
      cuerpo: { proposito: 'expirado' },
    });
    const cuerpo = r.response.cuerpo as {
      token?: string;
      expEpoch?: number;
      desfaseSegundos?: number;
      vigente?: boolean;
      message?: string;
    } | null;

    if (
      r.response.status === 200 &&
      cuerpo?.token &&
      cuerpo.vigente === false
    ) {
      const guardado = this.sesion.guardarTokenExpirado(cuerpo.token);
      return {
        ok: true,
        status: r.response.status,
        token: cuerpo.token,
        expiraEn: guardado.expiraEn,
        expEpoch: guardado.expEpoch,
        desfaseSegundos: cuerpo.desfaseSegundos ?? null,
        mensaje: `Token de laboratorio expirado generado: venció hace ${
          cuerpo.desfaseSegundos ?? '?'
        } segundo(s). Ejecuta PA-04 directamente (deja el campo vacío) o copia el token completo.`,
      };
    }

    if (r.response.status === 404) {
      return {
        ok: false,
        status: 404,
        token: null,
        expiraEn: null,
        expEpoch: null,
        desfaseSegundos: null,
        mensaje:
          'El objetivo no tiene habilitada la generación de tokens de laboratorio. Actívala con la variable de entorno LAB_TOKEN_EXPIRACION=true en el backend principal (local o Render) o pega un token ya expirado en el campo de PA-04.',
      };
    }

    throw new BadRequestException(
      `No fue posible generar el token de laboratorio expirado (HTTP ${
        r.response.status
      }). ${cuerpo?.message ?? ''}`.trim(),
    );
  }

  async descubrirPedidosAjenos(): Promise<{
    ok: boolean;
    atacanteSub: string | null;
    mensaje: string;
    pedidos: Array<{
      id: string;
      estado: string;
      total: number | null;
      fecha: string | null;
      propietarioEtiqueta: string;
      esDelAtacante: boolean;
    }>;
  }> {
    if (!this.sesion.token('admin')) {
      return {
        ok: false,
        atacanteSub: null,
        mensaje:
          'El descubrimiento de pedidos de laboratorio usa la sesión de administrador para listar los pedidos de todos los clientes. Captura la sesión de administrador en «Sesiones» y vuelve a intentarlo.',
        pedidos: [],
      };
    }

    const subAtacante = this.sesion.subDe('cliente');
    const r = await this.motor.ejecutar({
      metodo: 'GET',
      ruta: '/pedidos?todos=true',
      origenToken: 'admin',
    });

    if (r.response.status !== 200) {
      return {
        ok: false,
        atacanteSub: subAtacante ? `…${subAtacante.slice(-6)}` : null,
        mensaje: `El objetivo respondió HTTP ${r.response.status} al listar los pedidos con la sesión de administrador. Verifica que la cuenta de administrador tenga permisos y que la sesión esté vigente.`,
        pedidos: [],
      };
    }

    const cuerpo = r.response.cuerpo;
    const lista = Array.isArray(cuerpo)
      ? cuerpo
      : ((cuerpo as { items?: unknown[] })?.items ?? []);

    const pedidos = (lista as Array<Record<string, unknown>>)
      .map((p) => {
        const sub = typeof p.cliente_sub === 'string' ? p.cliente_sub : '';
        const esDelAtacante = subAtacante !== null && sub === subAtacante;
        const totalCrudo = p.total;
        const total =
          typeof totalCrudo === 'number'
            ? totalCrudo
            : totalCrudo != null && !Number.isNaN(Number(totalCrudo))
              ? Number(totalCrudo)
              : null;
        return {
          id: typeof p.id === 'string' ? p.id : '',
          estado: typeof p.estado === 'string' ? p.estado : '',
          total,
          fecha: typeof p.fecha === 'string' ? p.fecha : null,
          propietarioEtiqueta: esDelAtacante
            ? 'Tu sesión de cliente (no sirve para BOLA)'
            : `Otro cliente · …${sub.slice(-6)}`,
          esDelAtacante,
        };
      })
      .filter((p) => p.id.length > 0)
      .sort((a, b) => Number(a.esDelAtacante) - Number(b.esDelAtacante))
      .slice(0, 60);

    const ajenos = pedidos.filter((p) => !p.esDelAtacante).length;
    return {
      ok: true,
      atacanteSub: subAtacante ? `…${subAtacante.slice(-6)}` : null,
      mensaje:
        ajenos > 0
          ? `Se encontraron ${ajenos} pedido(s) de otros clientes de laboratorio. Selecciona uno para cargarlo en PE-03.`
          : 'No se encontraron pedidos de otros clientes. Genera un pedido con una segunda cuenta de laboratorio (o con los datos de demostración) antes de ejecutar PE-03.',
      pedidos,
    };
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
        intentosSolicitados?: number;
        intentosProcesados?: number;
        observacion?: string;
      } | null;
      const respuestaUtil =
        (resultado.response.status === 200 ||
          resultado.response.status === 201) &&
        c !== null;
      const solicitados = c?.intentosSolicitados ?? 0;
      const procesados = c?.intentosProcesados ?? 0;
      const bloqueo = c?.bloqueadoEn ?? null;

      if (!respuestaUtil) {
        cumple = false;
        observacion = `El servidor respondió ${resultado.response.status} sin el resumen de la simulación, por lo que no es posible evaluar la protección.`;
      } else if (modo === 'vulnerable') {
        cumple =
          c?.limiteActivo === false &&
          bloqueo === null &&
          procesados === solicitados &&
          solicitados > 0;
        observacion = `Sin límite activo el servidor procesó ${procesados} de ${solicitados} intento(s) y no bloqueó ninguno: la cuenta queda expuesta a intentos repetidos.`;
      } else {
        cumple =
          c?.limiteActivo === true &&
          typeof bloqueo === 'number' &&
          bloqueo > 0 &&
          bloqueo <= solicitados &&
          procesados < solicitados;
        observacion = `Con el límite activo el servidor procesó ${procesados} de ${solicitados} intento(s) y bloqueó a partir del intento ${
          bloqueo ?? 0
        }: la protección detuvo la secuencia antes de agotarla.`;
      }
    }

    if (def.id === 'PA-01' && resultado.response.status === 403) {
      const detalle = JSON.stringify(resultado.response.cuerpo ?? {});
      if (/verificaci.n en dos pasos|MFA/i.test(detalle)) {
        cumple = null;
        observacion =
          'El servidor exigió verificación en dos pasos: el token capturado es de nivel aal1 y la operación requiere aal2. ' +
          'No es un fallo de autorización, es una preparación incompleta del escenario. ' +
          'Captura de nuevo la sesión de administrador escribiendo el código de 6 dígitos en «Código de verificación en dos pasos» y repite PA-01. ' +
          'Si la cuenta de administrador de laboratorio no tiene MFA inscrito, el escenario responde 201 directamente.';
      }
    }

    if (def.id === 'PA-04' && resultado.request.tokenEnmascarado) {
      if (resultado.request.tokenExpiradoAlEnviar === false) {
        observacion =
          'El token enviado aún no estaba vencido, así que este intento NO demuestra la comprobación de expiración y no se cuenta como válido. ' +
          'Para demostrarlo hay tres caminos: (1) pulsa «Generar token expirado» para que el laboratorio emita un token ya vencido y firmado con una clave que el servidor acepta, y ejecuta PA-04 de inmediato; ' +
          '(2) pega un token auténtico cuya marca exp ya haya pasado; ' +
          '(3) muestra la prueba automatizada «Token de laboratorio para PA-04 (expiración)» de app-principal, que acepta un token de laboratorio vigente y rechaza el mismo token una vez vencido.';
        cumple = null;
      } else if (resultado.request.tokenExpiradoAlEnviar === true) {
        observacion =
          'Se envió un token con la marca de expiración ya vencida y el servidor lo rechazó al comprobar la expiración (la firma, el emisor y el destinatario eran válidos).';
      }
    }

    if (def.id === 'PA-04' && !resultado.request.tokenEnmascarado) {
      observacion =
        'No hay token para PA-04. Pulsa «Generar token expirado» para que el laboratorio emita uno ya vencido, o pega un token expirado en el campo del escenario.';
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
