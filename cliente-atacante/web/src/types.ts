export interface DefinicionEscenario {
  id: string;
  titulo: string;
  tipo: 'funcional' | 'explotacion' | 'autorizacion';
  metodo: string;
  ruta: string;
  origenToken: string;
  descripcion: string;
  preparacion: string;
  esperadoBase: string;
  dependeDeModo?: boolean;
  requiereProducto?: boolean;
  requierePedidoObjetivo?: boolean;
  restablecimiento?: string;
}

export interface ResultadoSolicitud {
  request: {
    metodo: string;
    url: string;
    envioToken: boolean;
    origenToken: string;
    tokenEnmascarado: string | null;
    tokenExpiradoAlEnviar: boolean | null;
    cabeceras: Record<string, string>;
    cuerpo?: unknown;
  };
  response: {
    status: number;
    tiempoMs: number;
    cuerpo: unknown;
  };
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

export interface EstadoSesion {
  email: string;
  capturadoEn: string;
  expiraEn: string | null;
  expirado: boolean;
  tokenEnmascarado: string | null;
  aal?: string | null;
}

export interface ConfigRespuesta {
  objetivo: string;
  vulnMode: string;
  supabaseConfigurado: boolean;
  permitirExplotacion: boolean;
  escenarios: DefinicionEscenario[];
  sesiones: Record<string, EstadoSesion>;
}

export interface EntradaHistorial {
  id: number;
  momento: string;
  origen: 'escenario' | 'consola' | 'terminal';
  etiqueta: string;
  metodo: string;
  ruta: string;
  status: number;
  tiempoMs: number;
  resultado: ResultadoSolicitud;
}

export interface TokenExpiradoLab {
  ok: boolean;
  status: number;
  token: string | null;
  expiraEn: string | null;
  expEpoch: number | null;
  desfaseSegundos: number | null;
  mensaje: string;
}

export interface PedidoDescubierto {
  id: string;
  estado: string;
  total: number | null;
  fecha: string | null;
  propietarioEtiqueta: string;
  esDelAtacante: boolean;
}

export interface DescubrimientoPedidos {
  ok: boolean;
  atacanteSub: string | null;
  mensaje: string;
  pedidos: PedidoDescubierto[];
}
