import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiGet, apiPost } from '../api';
import type {
  ConfigRespuesta,
  EntradaHistorial,
  ResultadoEscenario,
  ResultadoSolicitud,
} from '../types';
import { LabContext, type EstadoLab } from './labEstado';

export function LabProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const contador = useRef(0);

  const refrescar = useCallback(async () => {
    try {
      const c = await apiGet<ConfigRespuesta>('/api/config');
      setConfig(c);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración.');
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const anotar = useCallback(
    (
      origen: 'escenario' | 'consola' | 'terminal',
      etiqueta: string,
      resultado: ResultadoSolicitud,
    ) => {
      contador.current += 1;
      const entrada: EntradaHistorial = {
        id: contador.current,
        momento: new Date().toISOString(),
        origen,
        etiqueta,
        metodo: resultado.request.metodo,
        ruta: resultado.request.url.replace(/^https?:\/\/[^/]+/, ''),
        status: resultado.response.status,
        tiempoMs: resultado.response.tiempoMs,
        resultado,
      };
      setHistorial((h) => [entrada, ...h].slice(0, 100));
    },
    [],
  );

  const valor = useMemo<EstadoLab>(
    () => ({
      config,
      error,
      historial,
      refrescar,
      iniciarSesion: async (rol) => {
        const r = await apiPost<{ sesiones: ConfigRespuesta['sesiones'] }>(
          '/api/sesion',
          { rol },
        );
        setConfig((c) => (c ? { ...c, sesiones: r.sesiones } : c));
      },
      cerrarSesion: async (rol) => {
        const r = await apiPost<{ sesiones: ConfigRespuesta['sesiones'] }>(
          '/api/sesion/cerrar',
          { rol },
        );
        setConfig((c) => (c ? { ...c, sesiones: r.sesiones } : c));
      },
      ejecutarSolicitud: async (s, origen, etiqueta) => {
        const resultado = await apiPost<ResultadoSolicitud>('/api/ejecutar', s);
        anotar(origen, etiqueta ?? `${s.metodo} ${s.ruta}`, resultado);
        return resultado;
      },
      ejecutarEscenario: async (id, opciones, origen = 'escenario') => {
        const r = await apiPost<ResultadoEscenario>('/api/escenario', {
          id,
          ...opciones,
        });
        anotar(origen, `${id} · ${r.escenario.titulo}`, r.resultado);
        await refrescar();
        return r;
      },
      limpiarHistorial: () => setHistorial([]),
    }),
    [config, error, historial, refrescar, anotar],
  );

  return <LabContext.Provider value={valor}>{children}</LabContext.Provider>;
}
