import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigurado } from '../api/supabase';
import { apiFetch } from '../api/client';
import { AuthContext, type EstadoAuth, type Perfil } from './authEstado';

const registroAbierto =
  (import.meta.env.VITE_REGISTRO_ABIERTO ?? 'false').toLowerCase() === 'true';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState(false);
  const [mfaPendiente, setMfaPendiente] = useState<boolean | null>(null);
  const [recuperacion, setRecuperacion] = useState(false);

  const evaluarMfa = useCallback(async (): Promise<boolean> => {
    if (!supabaseConfigurado) {
      setMfaPendiente(false);
      return false;
    }
    const { data: sesionActual } = await supabase.auth.getSession();
    if (!sesionActual.session) {
      setMfaPendiente(false);
      return false;
    }
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      setMfaPendiente(true);
      return true;
    }
    const pendiente =
      data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel;
    setMfaPendiente(pendiente);
    return pendiente;
  }, []);

  const cargarPerfil = useCallback(async () => {
    const r = await apiFetch<Perfil>('/perfil');
    if (r.ok && r.data) {
      setPerfil(r.data);
      setErrorPerfil(false);
    } else {
      setErrorPerfil(true);
    }
  }, []);

  useEffect(() => {
    let activo = true;

    const flujoActual = () => {
      const flujo = new URLSearchParams(window.location.search).get('flujo');
      return {
        invitacion:
          window.location.pathname === '/aceptar-invitacion' ||
          flujo === 'invitacion',
        recuperacion:
          window.location.pathname === '/restablecer-contrasena' ||
          flujo === 'recuperacion',
      };
    };

    // La suscripción se registra antes de consultar la sesión para no perder
    // PASSWORD_RECOVERY durante la inicialización del callback de Supabase.
    const { data: sub } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (!activo) return;
      setSession(nueva);

      if (evento === 'PASSWORD_RECOVERY') {
        setRecuperacion(true);
        setMfaPendiente(false);
        setCargando(false);
        return;
      }

      if (!nueva) {
        setPerfil(null);
        setMfaPendiente(false);
        setRecuperacion(false);
        setCargando(false);
        return;
      }

      const flujo = flujoActual();
      if (flujo.recuperacion) {
        setRecuperacion(true);
        setMfaPendiente(false);
        setCargando(false);
        return;
      }
      if (flujo.invitacion || Boolean(nueva.user.invited_at)) {
        // No consultar /perfil todavía: ese endpoint acepta la invitación y
        // asigna el rol. Debe ocurrir después de que la persona cree su clave.
        setMfaPendiente(false);
        setCargando(false);
        return;
      }

      setTimeout(() => {
        if (!activo) return;
        void evaluarMfa();
        if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') {
          void cargarPerfil();
        }
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return;
      const actual = data.session;
      setSession(actual);
      if (actual) {
        const flujo = flujoActual();
        if (flujo.recuperacion) {
          setRecuperacion(true);
          setMfaPendiente(false);
        } else if (flujo.invitacion || Boolean(actual.user.invited_at)) {
          setMfaPendiente(false);
        } else {
          await evaluarMfa();
          await cargarPerfil();
        }
      } else {
        setMfaPendiente(false);
      }
      if (activo) setCargando(false);
    });

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil, evaluarMfa]);

  const valor = useMemo<EstadoAuth>(
    () => ({
      session,
      perfil,
      rol: perfil?.rol ?? null,
      esAdmin: perfil?.rol === 'admin',
      cargando,
      errorPerfil,
      configurado: supabaseConfigurado,
      registroAbierto,
      mfaPendiente,
      recuperacion,
      evaluarMfa,
      iniciarSesion: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          return { ok: false, mensaje: error.message };
        }
        const pendiente = await evaluarMfa();
        if (!pendiente) {
          await cargarPerfil();
          void apiFetch('/seguridad/inicio-sesion', { metodo: 'POST' });
        }
        return { ok: true };
      },
      registrarse: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });
        if (error) {
          return { ok: false, mensaje: error.message };
        }
        if (data.user && (data.user.identities ?? []).length === 0) {
          return {
            ok: false,
            mensaje: 'Ya existe una cuenta con este correo electrónico.',
          };
        }
        return { ok: true };
      },
      cerrarSesion: async () => {
        await supabase.auth.signOut();
        setPerfil(null);
        setErrorPerfil(false);
        setMfaPendiente(false);
      },
      recargarPerfil: cargarPerfil,
      enviarRecuperacion: async (email) => {
        // El origen debe ser exactamente el navegador actual: usar una URL
        // compilada de otro entorno rompe la verificación PKCE de Supabase.
        const base = window.location.origin.replace(/\/+$/, '');
        try {
          window.localStorage.setItem('quantumware-origen-recuperacion', base);
        } catch {
          /* almacenamiento no disponible */
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${base}/restablecer-contrasena?flujo=recuperacion`,
        });
        if (error) {
          if (error.status === 429) {
            return {
              ok: false,
              mensaje:
                'El proveedor de autenticación rechazó el envío por haber alcanzado su límite de correos (es un límite por hora del servicio de correo integrado de Supabase, compartido con las invitaciones). Para quitarlo hay que configurar un SMTP propio en Supabase.',
            };
          }
          return { ok: false, mensaje: error.message };
        }
        return { ok: true };
      },
      cambiarContrasena: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          return { ok: false, mensaje: error.message };
        }
        setRecuperacion(false);
        return { ok: true };
      },
      cambiarCorreo: async (email) => {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) {
          return { ok: false, mensaje: error.message };
        }
        return { ok: true };
      },
    }),
    [
      session,
      perfil,
      cargando,
      errorPerfil,
      mfaPendiente,
      recuperacion,
      cargarPerfil,
      evaluarMfa,
    ],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
