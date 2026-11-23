import { apiFetch } from './client';

const base = import.meta.env.VITE_API_BASE_URL ?? '';

export interface EventoNotificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  datos: Record<string, unknown>;
  creada: string;
}

export function abrirFlujoNotificaciones(
  onEvento: (evento: EventoNotificacion) => void,
): () => void {
  let fuente: EventSource | null = null;
  let cerrado = false;
  let reintento: ReturnType<typeof setTimeout> | null = null;

  const conectar = async () => {
    if (cerrado) {
      return;
    }
    const r = await apiFetch<{ ticket: string }>('/notificaciones/ticket', {
      metodo: 'POST',
    });
    if (!r.ok || !r.data?.ticket) {
      programarReintento();
      return;
    }
    fuente = new EventSource(
      `${base}/notificaciones/stream?ticket=${encodeURIComponent(r.data.ticket)}`,
    );
    fuente.onmessage = (e) => {
      try {
        onEvento(JSON.parse(e.data) as EventoNotificacion);
      } catch {
        fuente?.close();
      }
    };
    fuente.onerror = () => {
      fuente?.close();
      fuente = null;
      programarReintento();
    };
  };

  const programarReintento = () => {
    if (cerrado || reintento) {
      return;
    }
    reintento = setTimeout(() => {
      reintento = null;
      void conectar();
    }, 5000);
  };

  void conectar();

  return () => {
    cerrado = true;
    if (reintento) {
      clearTimeout(reintento);
    }
    fuente?.close();
  };
}
