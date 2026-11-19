import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Center,
  Loader,
  PasswordInput,
  Stack,
} from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  arranqueError,
  arranqueTieneCodigo,
  parametrosArranque,
} from '../auth/urlArranque';
import { useAuth } from '../auth/authEstado';
import { AuthShell } from '../components/AuthShell';

interface SenalesEnlace {
  tieneCodigo: boolean;
  errorDescripcion: string | null;
}

function leerSenalesIniciales(): SenalesEnlace {
  const p = parametrosArranque();
  return {
    tieneCodigo:
      arranqueTieneCodigo() || p.get('type') === 'recovery',
    errorDescripcion: arranqueError(),
  };
}

function traducirErrorEnlace(mensaje: string): string {
  const texto = mensaje.toLowerCase();
  if (texto.includes('expired')) {
    return 'El enlace de recuperación expiró. Solicita uno nuevo para continuar.';
  }
  if (
    texto.includes('invalid') ||
    texto.includes('not found') ||
    texto.includes('used')
  ) {
    return 'El enlace de recuperación no es válido o ya fue utilizado. Solicita uno nuevo.';
  }
  if (texto.includes('verifier') || texto.includes('code challenge')) {
    return 'Por seguridad, el enlace debe abrirse en el mismo navegador donde solicitaste la recuperación. Solicita un enlace nuevo desde este navegador.';
  }
  return `No fue posible validar el enlace de recuperación: ${mensaje}`;
}

export function RestablecerPage() {
  const { session, recuperacion, cambiarContrasena, recargarPerfil } = useAuth();
  const navigate = useNavigate();
  const [senales] = useState<SenalesEnlace>(leerSenalesIniciales);
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expiro, setExpiro] = useState(false);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const contextoRecuperacion = recuperacion || senales.tieneCodigo;
  const sesionLista = contextoRecuperacion && Boolean(session);
  const errorInmediato = senales.errorDescripcion
    ? traducirErrorEnlace(senales.errorDescripcion)
    : !contextoRecuperacion
      ? 'Abre esta página desde el enlace que recibiste por correo. Sin ese enlace no es posible validar la solicitud.'
      : null;
  const origenSolicitud = (() => {
    try {
      return window.localStorage.getItem('quantumware-origen-recuperacion');
    } catch {
      return null;
    }
  })();
  const desajusteOrigen =
    Boolean(origenSolicitud) &&
    origenSolicitud !== window.location.origin.replace(/\/+$/, '');
  const errorEnlace =
    errorInmediato ??
    (expiro && !sesionLista
      ? desajusteOrigen
        ? `El enlace se solicitó desde ${origenSolicitud ?? ''} y lo estás abriendo en ${window.location.origin}. Por seguridad, PKCE exige la misma dirección: abre el enlace en ${origenSolicitud ?? 'la dirección original'} o solicita uno nuevo desde aquí.`
        : `No fue posible abrir la sesión de recuperación en ${window.location.origin}. El enlace solo funciona en el mismo navegador y en la misma dirección (localhost y 127.0.0.1 no son equivalentes) desde donde lo solicitaste, y solo puede usarse una vez. Solicita un enlace nuevo desde esta misma dirección.`
      : null);
  const esperando = !sesionLista && !errorEnlace;

  useEffect(() => {
    if (errorInmediato || sesionLista || !contextoRecuperacion) {
      return;
    }
    const limite = window.setTimeout(() => setExpiro(true), 10000);
    return () => window.clearTimeout(limite);
  }, [errorInmediato, sesionLista, contextoRecuperacion]);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    const r = await cambiarContrasena(password);
    setEnviando(false);
    if (r.ok) {
      await recargarPerfil();
      setListo(true);
      setTimeout(() => navigate('/u/panel', { replace: true }), 1800);
      return;
    }
    const detalle = (r.mensaje ?? '').toLowerCase();
    if (detalle.includes('should be different')) {
      setError('La contraseña nueva debe ser diferente a la anterior.');
    } else if (detalle.includes('session') || detalle.includes('jwt')) {
      setError(
        'La sesión de recuperación ya no es válida. Solicita un enlace nuevo y ábrelo en este navegador.',
      );
    } else {
      setError(
        `No fue posible actualizar la contraseña${
          r.mensaje ? `: ${r.mensaje}` : '.'
        }`,
      );
    }
  };

  return (
    <AuthShell
      titulo="Nueva contraseña"
      descripcion="Establece una contraseña nueva para tu cuenta."
    >
      {esperando ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : (
        <>
          {errorEnlace && !sesionLista && (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
              {errorEnlace}{' '}
              <Anchor component={Link} to="/recuperar-contrasena" size="sm">
                Solicitar un enlace nuevo
              </Anchor>
            </Alert>
          )}
          {listo ? (
            <Alert color="teal" icon={<IconCircleCheck size={18} />}>
              Contraseña actualizada. Entrando al sistema.
            </Alert>
          ) : (
            sesionLista && (
              <>
                {error && (
                  <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                    {error}
                  </Alert>
                )}
                <form onSubmit={enviar} noValidate>
                  <Stack gap="sm">
                    <PasswordInput
                      label="Nueva contraseña"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.currentTarget.value)}
                    />
                    <PasswordInput
                      label="Confirmar contraseña"
                      autoComplete="new-password"
                      value={confirmacion}
                      onChange={(e) => setConfirmacion(e.currentTarget.value)}
                    />
                    <Button type="submit" loading={enviando} fullWidth>
                      Guardar contraseña
                    </Button>
                  </Stack>
                </form>
              </>
            )
          )}
        </>
      )}
      <Anchor component={Link} to="/login" size="sm" ta="center">
        Volver al inicio de sesión
      </Anchor>
    </AuthShell>
  );
}
