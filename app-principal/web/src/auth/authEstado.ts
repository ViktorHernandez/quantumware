import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface Perfil {
  sub: string;
  email: string | null;
  rol: string | null;
  nombre: string | null;
  telefono: string | null;
  sinRolAsignado: boolean;
}

export interface Resultado {
  ok: boolean;
  mensaje?: string;
}

export interface EstadoAuth {
  session: Session | null;
  perfil: Perfil | null;
  rol: string | null;
  esAdmin: boolean;
  cargando: boolean;
  errorPerfil: boolean;
  configurado: boolean;
  registroAbierto: boolean;
  mfaPendiente: boolean | null;
  recuperacion: boolean;
  evaluarMfa: () => Promise<boolean>;
  iniciarSesion: (email: string, password: string) => Promise<Resultado>;
  registrarse: (email: string, password: string) => Promise<Resultado>;
  cerrarSesion: () => Promise<void>;
  recargarPerfil: () => Promise<void>;
  enviarRecuperacion: (email: string) => Promise<Resultado>;
  cambiarContrasena: (password: string) => Promise<Resultado>;
  cambiarCorreo: (email: string) => Promise<Resultado>;
}

export const AuthContext = createContext<EstadoAuth | null>(null);

export function useAuth(): EstadoAuth {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
