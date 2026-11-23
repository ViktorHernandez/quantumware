import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Center,
  Loader,
  PasswordInput,
  Stack,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/authEstado';
import { AuthShell } from './AuthShell';

interface EstadoEnlace {
  valido: boolean;
  tipo: 'invitacion' | 'recuperacion' | null;
  email: string | null;
  mensaje: string | null;
}

interface Props {
  tipoEsperado: 'invitacion' | 'recuperacion';
  titulo: string;
  descripcion: string;
  textoBoton: string;
  rutaSolicitar: string;
  textoSolicitar: string;
}

export function EstablecerCredencial({
  tipoEsperado,
  titulo,
  descripcion,
  textoBoton,
  rutaSolicitar,
  textoSolicitar,
}: Props) {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const navigate = useNavigate();
  const { session, iniciarSesion, cerrarSesion } = useAuth();

  const [estado, setEstado] = useState<EstadoEnlace | null>(() =>
    token
      ? null
      : {
          valido: false,
          tipo: null,
          email: null,
          mensaje:
            'Abre esta página desde el enlace que recibiste por correo electrónico.',
        },
  );
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let activo = true;
    if (!token) {
      return;
    }
    void apiFetch<EstadoEnlace>(
      `/cuenta/enlace/${encodeURIComponent(token)}`,
    ).then((r) => {
      if (!activo) return;
      if (!r.ok || !r.data) {
        setEstado({
          valido: false,
          tipo: null,
          email: null,
          mensaje:
            r.mensaje ??
            'No fue posible comprobar el enlace. Inténtalo de nuevo en unos minutos.',
        });
        return;
      }
      if (r.data.valido && r.data.tipo !== tipoEsperado) {
        setEstado({
          valido: false,
          tipo: r.data.tipo,
          email: null,
          mensaje:
            r.data.tipo === 'invitacion'
              ? 'Este enlace es una invitación. Ábrelo en la página de aceptar invitación.'
              : 'Este enlace es de recuperación de contraseña. Ábrelo en la página de restablecer contraseña.',
        });
        return;
      }
      setEstado(r.data);
    });
    return () => {
      activo = false;
    };
  }, [token, tipoEsperado]);

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
    const r = await apiFetch<{ ok: boolean; email: string | null }>(
      '/cuenta/contrasena',
      { metodo: 'POST', cuerpo: { token, password } },
    );
    if (!r.ok) {
      setEnviando(false);
      setError(r.mensaje ?? 'No fue posible establecer la contraseña.');
      return;
    }

    const correo = r.data?.email ?? estado?.email ?? null;
    if (session) {
      await cerrarSesion();
    }
    setListo(true);
    if (correo) {
      const acceso = await iniciarSesion(correo, password);
      setEnviando(false);
      if (acceso.ok) {
        setTimeout(() => navigate('/u/panel', { replace: true }), 1200);
        return;
      }
    }
    setEnviando(false);
    setTimeout(() => navigate('/login', { replace: true }), 1800);
  };

  return (
    <AuthShell titulo={titulo} descripcion={descripcion}>
      {estado === null ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : listo ? (
        <Alert color="teal" icon={<IconCircleCheck size={18} />}>
          Contraseña establecida. Entrando al sistema.
        </Alert>
      ) : !estado.valido ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
          {estado.mensaje ?? 'El enlace no es válido.'}{' '}
          <Anchor component={Link} to={rutaSolicitar} size="sm">
            {textoSolicitar}
          </Anchor>
        </Alert>
      ) : (
        <>
          {estado.email && (
            <Text size="sm" c="dimmed">
              Cuenta: {estado.email}
            </Text>
          )}
          {session && (
            <Alert color="blue" icon={<IconAlertTriangle size={18} />}>
              Hay una sesión abierta en este navegador. Se cerrará para
              continuar con la cuenta del enlace.
            </Alert>
          )}
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
                {textoBoton}
              </Button>
            </Stack>
          </form>
        </>
      )}
      <Anchor component={Link} to="/login" size="sm" ta="center">
        Volver al inicio de sesión
      </Anchor>
    </AuthShell>
  );
}
