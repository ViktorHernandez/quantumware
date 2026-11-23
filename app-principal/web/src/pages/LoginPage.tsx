import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authEstado';
import { AuthShell } from '../components/AuthShell';

export function LoginPage() {
  const { session, configurado, iniciarSesion, mfaPendiente } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [enviando, setEnviando] = useState(false);

  if (session && !enviando) {
    if (mfaPendiente === null) {
      return null;
    }
    return (
      <Navigate to={mfaPendiente ? '/mfa-verificacion' : '/u/panel'} replace />
    );
  }

  const validar = () => {
    const e: { email?: string; password?: string } = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      e.email = 'Escribe un correo electrónico válido.';
    }
    if (password.length < 6) {
      e.password = 'La contraseña debe tener al menos 6 caracteres.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!validar()) {
      return;
    }
    setEnviando(true);
    const r = await iniciarSesion(email.trim(), password);
    if (!r.ok) {
      setEnviando(false);
      setError(
        'No fue posible iniciar sesión. Revisa tu correo y tu contraseña, o confirma tu cuenta si aún no lo has hecho.',
      );
      return;
    }
    navigate('/u/panel', { replace: true });
    setEnviando(false);
  };

  return (
    <AuthShell
      titulo="Iniciar sesión"
      descripcion="Accede con la cuenta registrada en el proveedor de identidad."
    >
      {!configurado && (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
          El proveedor de identidad no está configurado. Define
          VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en
          app-principal/web/.env
        </Alert>
      )}
      {error && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />}>
          {error}
        </Alert>
      )}
      <form onSubmit={enviar} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Correo electrónico"
            placeholder="nombre@correo.com"
            type="email"
            autoComplete="email"
            value={email}
            error={errores.email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label="Contraseña"
            autoComplete="current-password"
            value={password}
            error={errores.password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Group justify="space-between" mt={4}>
            <Anchor component={Link} to="/recuperar-contrasena" size="sm">
              ¿Olvidaste tu contraseña?
            </Anchor>
          </Group>
          <Button type="submit" loading={enviando} fullWidth mt="xs">
            Entrar
          </Button>
        </Stack>
      </form>
      <Text size="sm" ta="center" c="dimmed">
        ¿No tienes cuenta?{' '}
        <Anchor component={Link} to="/registro" size="sm">
          Crear una cuenta
        </Anchor>
      </Text>
    </AuthShell>
  );
}
