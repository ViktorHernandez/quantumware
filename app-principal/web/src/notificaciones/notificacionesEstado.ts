import { createContext, useContext } from 'react';

export interface EstadoNotificaciones {
  contador: number;
  revision: number;
  refrescarContador: () => Promise<void>;
  marcarLeida: (id: string) => Promise<void>;
  marcarTodas: () => Promise<void>;
}

export const NotificacionesContext = createContext<EstadoNotificaciones | null>(
  null,
);

export function useNotificaciones(): EstadoNotificaciones {
  const ctx = useContext(NotificacionesContext);
  if (!ctx) {
    throw new Error(
      'useNotificaciones debe usarse dentro de NotificacionesProvider',
    );
  }
  return ctx;
}
