import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { apiFetch } from '../api/client';
import {
  abrirFlujoNotificaciones,
  type EventoNotificacion,
} from '../api/notificacionesRealtime';
import {
  NotificacionesContext,
  type EstadoNotificaciones,
} from './notificacionesEstado';

export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const [contador, setContador] = useState(0);
  const [revision, setRevision] = useState(0);

  const refrescarContador = useCallback(async () => {
    const r = await apiFetch<{ noLeidas: number }>('/notificaciones/contador');
    if (r.ok && r.data) {
      setContador(r.data.noLeidas);
    }
  }, []);

  const marcarLeida = useCallback(
    async (id: string) => {
      await apiFetch(`/notificaciones/${id}/leer`, { metodo: 'PATCH' });
      await refrescarContador();
      setRevision((n) => n + 1);
    },
    [refrescarContador],
  );

  const marcarTodas = useCallback(async () => {
    await apiFetch('/notificaciones/leer-todas', { metodo: 'POST' });
    setContador(0);
    setRevision((n) => n + 1);
  }, []);

  useEffect(() => {
    let vigente = true;
    const actualizar = () => {
      void apiFetch<{ noLeidas: number }>('/notificaciones/contador').then(
        (r) => {
          if (vigente && r.ok && r.data) {
            setContador(r.data.noLeidas);
          }
        },
      );
    };
    actualizar();
    const temporizador = setInterval(actualizar, 30000);
    return () => {
      vigente = false;
      clearInterval(temporizador);
    };
  }, []);

  useEffect(() => {
    const vistos = new Set<string>();
    const recibir = (evento: EventoNotificacion) => {
      if (vistos.has(evento.id)) {
        return;
      }
      vistos.add(evento.id);
      void refrescarContador();
      setRevision((n) => n + 1);
      notifications.show({
        id: `notificacion-${evento.id}`,
        title: evento.titulo,
        message: evento.mensaje,
      });
    };
    return abrirFlujoNotificaciones(recibir);
  }, [refrescarContador]);

  const valor = useMemo<EstadoNotificaciones>(
    () => ({
      contador,
      revision,
      refrescarContador,
      marcarLeida,
      marcarTodas,
    }),
    [contador, revision, refrescarContador, marcarLeida, marcarTodas],
  );

  return (
    <NotificacionesContext.Provider value={valor}>
      {children}
    </NotificacionesContext.Provider>
  );
}
