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
      arranqueTieneCodigo() || p.get('type') === 'invite',
    errorDescripcion: arranqueError(),
  };
}

function traducirError(mensaje: string): string {
  const texto = mensaje.toLowerCase();
  if (texto.includes('expired')) {
    return 'La invitación expiró. Pide al administrador que te envíe una nueva.';
  }
  if (
    texto.includes('invalid') ||
    texto.includes('not found') ||
    texto.includes('used')
  ) {
    return 'La invitación no es válida o ya fue utilizada. Pide una invitación nueva.';
  }
  if (texto.includes('verifier') || texto.includes('code challenge')) {
    return 'Por seguridad, abre la invitación en el mismo navegador donde la recibiste.';
  }
  return `No fue posible validar la invitación: ${mensaje}`;
}

export function AceptarInvitacionPage() {
  const { session, perfil, cambiarContrasena, recargarPerfil } = useAuth();
  const navigate = useNavigate();
  const [senales] = useState<SenalesEnlace>(leerSenalesIniciales);
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expiro, setExpiro] = useState(false);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const correoInvitado = session?.user?.email ?? null;
  const errorInmediato = senales.errorDescripcion
    ? traducirError(senales.errorDescripcion)
    : !session && !senales.tieneCodigo
      ? 'Abre esta página desde el enlace de invitación que recibiste por correo.'
      : null;
  const errorEnlace =
    errorInmediato ??
    (expiro && !session
      ? 'La invitación no pudo validarse: puede haber expirado, haberse revocado o ya haberse utilizado. Pide una invitación nueva.'
      : null);
  const esperando = !session && !errorEnlace;

  useEffect(() => {
    if (errorInmediato || session || !senales.tieneCodigo) {
      return;
    }
    const limite = window.setTimeout(() => setExpiro(true), 10000);
    return () => window.clearTimeout(limite);
  }, [errorInmediato, session, senales.tieneCodigo]);

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
    if (!r.ok) {
      setEnviando(false);
      setError(
        `No fue posible establecer la contraseña${
          r.mensaje ? `: ${r.mensaje}` : '.'
        }`,
      );
      return;
    }
    await recargarPerfil();
    setEnviando(false);
    setListo(true);
    setTimeout(() => navigate('/u/panel', { replace: true }), 1800);
  };

  return (
    <AuthShell
      titulo="Aceptar invitación"
      descripcion="Crea tu contraseña para activar tu cuenta de QuantumWare."
    >
      {esperando ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : (
        <>
          {errorEnlace && !session && (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
              {errorEnlace}
            </Alert>
          )}
          {listo ? (
            <Alert color="teal" icon={<IconCircleCheck size={18} />}>
              {perfil?.rol
                ? `Cuenta activada con el rol "${perfil.rol}". Entrando al sistema.`
                : 'Contraseña establecida. Entrando al sistema.'}
            </Alert>
          ) : (
            session && (
              <>
                {correoInvitado && (
                  <Text size="sm" c="dimmed">
                    Invitación para <b>{correoInvitado}</b>
                  </Text>
                )}
                {error && (
                  <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                    {error}
                  </Alert>
                )}
                <form onSubmit={enviar} noValidate>
                  <Stack gap="sm">
                    <PasswordInput
                      label="Crea tu contraseña"
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
                      Activar mi cuenta
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
