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
  DescubrimientoPedidos,
  EntradaHistorial,
  ResultadoEscenario,
  ResultadoSolicitud,
  TokenExpiradoLab,
} from '../types';
import { LabContext, type EstadoLab } from './labEstado';

export function LabProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<EntradaHistorial[]>([]);
  const contador = useRef(0);
  const [enEjecucion, setEnEjecucion] = useState(false);
  const abortoRef = useRef<AbortController | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const c = await apiGet<ConfigRespuesta>('/api/config');
      setConfig(c);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo cargar la configuración.',
      );
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
      iniciarSesion: async (rol, codigoMfa) => {
        const r = await apiPost<{
          sesiones: ConfigRespuesta['sesiones'];
          mfaPendiente: boolean;
          aal: string | null;
        }>('/api/sesion', {
          rol,
          ...(codigoMfa ? { codigoMfa } : {}),
        });
        setConfig((c) => (c ? { ...c, sesiones: r.sesiones } : c));
        return { mfaPendiente: r.mfaPendiente, aal: r.aal };
      },
      generarTokenExpirado: async () => {
        const r = await apiPost<TokenExpiradoLab>(
          '/api/sesion/apartar-expiracion',
          {},
        );
        await refrescar();
        return r;
      },
      descubrirPedidos: async () => {
        return apiGet<DescubrimientoPedidos>('/api/lab/pedidos-descubribles');
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
      enEjecucion,
      detenerEjecucion: () => {
        abortoRef.current?.abort();
      },
      ejecutarEscenario: async (id, opciones, origen = 'escenario') => {
        abortoRef.current?.abort();
        const control = new AbortController();
        abortoRef.current = control;
        setEnEjecucion(true);
        let r: ResultadoEscenario;
        try {
          r = await apiPost<ResultadoEscenario>(
            '/api/escenario',
            { id, ...opciones },
            control.signal,
          );
        } finally {
          setEnEjecucion(false);
          if (abortoRef.current === control) {
            abortoRef.current = null;
          }
        }
        anotar(origen, `${id} · ${r.escenario.titulo}`, r.resultado);
        await refrescar();
        return r;
      },
      limpiarHistorial: () => setHistorial([]),
    }),
    [config, error, historial, refrescar, anotar, enEjecucion],
  );

  return <LabContext.Provider value={valor}>{children}</LabContext.Provider>;
}
