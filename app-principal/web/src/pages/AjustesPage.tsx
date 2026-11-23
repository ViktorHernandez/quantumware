import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconLogout } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authEstado';
import { MfaPanel } from '../components/MfaPanel';
import { fechaHora } from '../utils/formato';

export function AjustesPage() {
  const { perfil, session, cambiarContrasena, cambiarCorreo, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [correo, setCorreo] = useState('');
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);

  const actualizarPassword = async () => {
    if (password.length < 8) {
      notifications.show({
        color: 'yellow',
        message: 'La contraseña debe tener al menos 8 caracteres.',
      });
      return;
    }
    if (password !== confirmacion) {
      notifications.show({ color: 'yellow', message: 'Las contraseñas no coinciden.' });
      return;
    }
    setGuardandoPass(true);
    const r = await cambiarContrasena(password);
    setGuardandoPass(false);
    if (r.ok) {
      setPassword('');
      setConfirmacion('');
      notifications.show({ color: 'teal', message: 'Contraseña actualizada.' });
    } else {
      notifications.show({
        color: 'red',
        message: 'No se pudo actualizar la contraseña.',
      });
    }
  };

  const actualizarCorreo = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
      notifications.show({ color: 'yellow', message: 'Escribe un correo válido.' });
      return;
    }
    setGuardandoCorreo(true);
    const r = await cambiarCorreo(correo.trim());
    setGuardandoCorreo(false);
    if (r.ok) {
      setCorreo('');
      notifications.show({
        color: 'teal',
        message: 'Revisa tu correo para confirmar el cambio de dirección.',
      });
    } else {
      notifications.show({ color: 'red', message: 'No se pudo cambiar el correo.' });
    }
  };

  const expira = session?.expires_at
    ? fechaHora(new Date(session.expires_at * 1000))
    : '—';

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Ajustes y seguridad</Title>
        <Text c="dimmed" size="sm">
          Gestión de credenciales y de la sesión activa
        </Text>
      </div>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card>
            <Stack gap="sm">
              <Text fw={600}>Cambiar contraseña</Text>
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
              <Group justify="flex-end">
                <Button onClick={actualizarPassword} loading={guardandoPass}>
                  Actualizar contraseña
                </Button>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card>
            <Stack gap="sm">
              <Text fw={600}>Cambiar correo electrónico</Text>
              <Alert color="blue" icon={<IconInfoCircle size={18} />} p="xs">
                El cambio requiere confirmación desde el correo nuevo.
              </Alert>
              <TextInput
                label="Correo actual"
                value={perfil?.email ?? ''}
                disabled
              />
              <TextInput
                label="Correo nuevo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button onClick={actualizarCorreo} loading={guardandoCorreo}>
                  Solicitar cambio
                </Button>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={12}>
          <MfaPanel />
        </Grid.Col>

        <Grid.Col span={12}>
          <Card>
            <Stack gap="sm">
              <Text fw={600}>Sesión activa</Text>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  El token de acceso expira
                </Text>
                <Text size="sm">{expira}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                La sesión se renueva automáticamente mientras la pestaña esté
                abierta. El servidor verifica el token en cada solicitud y no
                conserva estado de sesión.
              </Text>
              <Divider />
              <Group justify="flex-end">
                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconLogout size={16} />}
                  onClick={async () => {
                    await cerrarSesion();
                    navigate('/login', { replace: true });
                  }}
                >
                  Cerrar sesión
                </Button>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
