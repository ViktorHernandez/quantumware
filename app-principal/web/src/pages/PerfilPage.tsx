import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/authEstado';
import type { Perfil } from '../auth/authEstado';

interface PropsFormularioPerfil {
  perfil: Perfil | null;
  alGuardar: () => Promise<void>;
}

function FormularioPerfil({ perfil, alGuardar }: PropsFormularioPerfil) {
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [telefono, setTelefono] = useState(perfil?.telefono ?? '');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (telefono && !/^[0-9+()\s-]*$/.test(telefono)) {
      notifications.show({
        color: 'yellow',
        message: 'El teléfono solo admite dígitos y los signos + ( ) - y espacios.',
      });
      return;
    }
    setGuardando(true);
    const r = await apiFetch<Perfil>('/perfil', {
      metodo: 'PUT',
      cuerpo: { nombre: nombre.trim(), telefono: telefono.trim() },
    });
    setGuardando(false);
    if (r.ok) {
      if (r.data) {
        setNombre(r.data.nombre ?? '');
        setTelefono(r.data.telefono ?? '');
      }
      await alGuardar();
      notifications.show({ color: 'teal', message: 'Perfil actualizado.' });
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo actualizar el perfil.',
      });
    }
  };

  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>Información personal</Text>
        <TextInput
          label="Nombre"
          maxLength={120}
          value={nombre}
          onChange={(e) => setNombre(e.currentTarget.value)}
        />
        <TextInput
          label="Teléfono"
          maxLength={30}
          placeholder="+52 55 0000 0000"
          value={telefono}
          onChange={(e) => setTelefono(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xs">
          <Button onClick={guardar} loading={guardando}>
            Guardar cambios
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export function PerfilPage() {
  const { perfil, recargarPerfil } = useAuth();

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Mi perfil</Title>
        <Text c="dimmed" size="sm">
          Datos personales asociados a tu cuenta
        </Text>
      </div>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <FormularioPerfil
            key={perfil?.sub ?? 'sin-perfil'}
            perfil={perfil}
            alGuardar={recargarPerfil}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card>
            <Stack gap="sm">
              <Text fw={600}>Cuenta</Text>
              <div>
                <Text size="xs" c="dimmed">
                  Correo electrónico
                </Text>
                <Text size="sm">{perfil?.email ?? '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Rol asignado por el servidor
                </Text>
                <Badge
                  variant="light"
                  color={perfil?.rol === 'admin' ? 'grape' : 'blue'}
                  mt={4}
                >
                  {perfil?.rol ?? 'sin rol asignado'}
                </Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Identificador de usuario
                </Text>
                <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>
                  {perfil?.sub ?? '—'}
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
