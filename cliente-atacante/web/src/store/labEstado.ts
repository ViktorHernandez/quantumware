import { createContext, useContext } from 'react';
import type {
  ConfigRespuesta,
  DescubrimientoPedidos,
  EntradaHistorial,
  ResultadoEscenario,
  ResultadoSolicitud,
  TokenExpiradoLab,
} from '../types';

export interface SolicitudManual {
  metodo: string;
  ruta: string;
  origenToken: string;
  tokenManual?: string;
  cuerpo?: Record<string, unknown>;
  cabeceras?: Record<string, string>;
}

export interface EstadoLab {
  config: ConfigRespuesta | null;
  error: string | null;
  historial: EntradaHistorial[];
  refrescar: () => Promise<void>;
  iniciarSesion: (
    rol: 'admin' | 'cliente',
    codigoMfa?: string,
  ) => Promise<{ mfaPendiente: boolean; aal: string | null }>;
  generarTokenExpirado: () => Promise<TokenExpiradoLab>;
  descubrirPedidos: () => Promise<DescubrimientoPedidos>;
  cerrarSesion: (rol: 'admin' | 'cliente') => Promise<void>;
  ejecutarSolicitud: (
    s: SolicitudManual,
    origen: 'consola' | 'terminal',
    etiqueta?: string,
  ) => Promise<ResultadoSolicitud>;
  ejecutarEscenario: (
    id: string,
    opciones?: {
      tokenManual?: string;
      pedidoObjetivo?: string;
      cantidad?: number;
    },
    origen?: 'escenario' | 'terminal',
  ) => Promise<ResultadoEscenario>;
  limpiarHistorial: () => void;
  enEjecucion: boolean;
  detenerEjecucion: () => void;
}

export const LabContext = createContext<EstadoLab | null>(null);

export function useLab(): EstadoLab {
  const ctx = useContext(LabContext);
  if (!ctx) {
    throw new Error('useLab debe usarse dentro de LabProvider');
  }
  return ctx;
}
