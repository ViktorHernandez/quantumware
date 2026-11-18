import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconInfoCircle,
  IconMailForward,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { apiFetch } from '../api/client';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useAuth } from '../auth/authEstado';
import { EstadoVacio } from '../components/EstadoVacio';
import { fechaHora } from '../utils/formato';

interface UsuarioRol {
  user_id: string;
  email: string | null;
  rol: string | null;
  nombre: string | null;
  telefono: string | null;
  estado: string;
  tienePerfil: boolean;
  actualizado: string | null;
}

interface RespuestaUsuarios {
  items: UsuarioRol[];
  adminConfigurado: boolean;
}

interface Invitacion {
  id: string;
  email: string;
  rol: string;
  estado: string;
  expira_en: string;
  creado_en: string;
  aceptada_en: string | null;
}

const COLOR_INVITACION: Record<string, string> = {
  pendiente: 'blue',
  aceptada: 'teal',
  revocada: 'gray',
  expirada: 'orange',
};

export function UsuariosPage() {
  const { perfil } = useAuth();
  const [filas, setFilas] = useState<UsuarioRol[]>([]);
  const [adminConfigurado, setAdminConfigurado] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('todos');
  const [abierto, { open, close }] = useDisclosure(false);
  const [nuevoSub, setNuevoSub] = useState('');
  const [nuevoRol, setNuevoRol] = useState<string>('cliente');
  const [guardando, setGuardando] = useState(false);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [modalInvitar, invitarModal] = useDisclosure(false);
  const [correoInvitar, setCorreoInvitar] = useState('');
  const [rolInvitar, setRolInvitar] = useState<string>('cliente');
  const [invitando, setInvitando] = useState(false);
  const [aEliminar, setAEliminar] = useState<UsuarioRol | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargarInvitaciones = useCallback(async () => {
    const r = await apiFetch<{ items: Invitacion[] }>('/usuarios/invitaciones');
    if (r.ok && r.data) {
      setInvitaciones(r.data.items);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void cargarInvitaciones(), 0);
    return () => clearTimeout(t);
  }, [cargarInvitaciones]);

  const invitar = async () => {
    const correo = correoInvitar.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
      notifications.show({
        color: 'yellow',
        message: 'Escribe un correo electrónico válido.',
      });
      return;
    }
    setInvitando(true);
    const r = await apiFetch('/usuarios/invitaciones', {
      metodo: 'POST',
      cuerpo: { email: correo, rol: rolInvitar },
    });
    setInvitando(false);
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo enviar la invitación.',
      });
      return;
    }
    notifications.show({
      color: 'teal',
      message: `Invitación enviada a ${correo}.`,
    });
    setCorreoInvitar('');
    setRolInvitar('cliente');
    invitarModal.close();
    await cargarInvitaciones();
  };

  const revocar = async (id: string) => {
    const r = await apiFetch(`/usuarios/invitaciones/${id}`, {
      metodo: 'DELETE',
    });
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo revocar la invitación.',
      });
      return;
    }
    notifications.show({ color: 'teal', message: 'Invitación revocada.' });
    await cargarInvitaciones();
  };

  const eliminarCuenta = async () => {
    if (!aEliminar) {
      return;
    }
    setEliminando(true);
    const r = await apiFetch(`/usuarios/${aEliminar.user_id}`, {
      metodo: 'DELETE',
    });
    setEliminando(false);
    if (!r.ok) {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo eliminar la cuenta.',
      });
      return;
    }
    notifications.show({ color: 'teal', message: 'Cuenta eliminada.' });
    setAEliminar(null);
    await cargar();
    await cargarInvitaciones();
  };

  const cargar = useCallback(async () => {
    const params = new URLSearchParams();
    if (busqueda.trim()) {
      params.set('q', busqueda.trim());
    }
    if (filtroRol !== 'todos') {
      params.set('rol', filtroRol);
    }
    const sufijo = params.toString() ? `?${params.toString()}` : '';
    const r = await apiFetch<RespuestaUsuarios>(`/usuarios${sufijo}`);
    if (r.ok && r.data) {
      setFilas(r.data.items);
      setAdminConfigurado(r.data.adminConfigurado);
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudieron cargar los usuarios.',
      });
    }
  }, [busqueda, filtroRol]);

  useEffect(() => {
    const t = setTimeout(() => void cargar(), 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const asignar = async (user_id: string, rol: string) => {
    const r = await apiFetch<RespuestaUsuarios>('/usuarios/rol', {
      metodo: 'POST',
      cuerpo: { user_id, rol },
    });
    if (r.ok && r.data) {
      setFilas(r.data.items);
      setAdminConfigurado(r.data.adminConfigurado);
      notifications.show({ color: 'teal', message: 'Rol actualizado.' });
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo actualizar el rol.',
      });
    }
  };

  const agregar = async () => {
    const sub = nuevoSub.trim();
    if (!/^[0-9a-fA-F-]{36}$/.test(sub)) {
      notifications.show({
        color: 'yellow',
        message: 'El identificador debe ser un UUID de 36 caracteres.',
      });
      return;
    }
    setGuardando(true);
    await asignar(sub, nuevoRol);
    setGuardando(false);
    setNuevoSub('');
    setNuevoRol('cliente');
    close();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Usuarios y roles</Title>
          <Text c="dimmed" size="sm">
            La autorización se resuelve en el servidor a partir de esta tabla
          </Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftSection={<IconMailForward size={16} />}
            onClick={invitarModal.open}
          >
            Invitar usuario
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Asignar rol
          </Button>
        </Group>
      </Group>

      {!adminConfigurado && (
        <Alert color="blue" icon={<IconInfoCircle size={18} />}>
          El correo se muestra para las cuentas que ya iniciaron sesión al menos
          una vez. Para listar las cuentas que todavía no han entrado y mostrar
          su correo, configura la clave de servicio de Supabase en el servidor
          (SUPABASE_SERVICE_ROLE_KEY). Nunca se expone al navegador.
        </Alert>
      )}

      <Group>
        <TextInput
          placeholder="Buscar por nombre, correo o identificador"
          leftSection={<IconSearch size={16} />}
          value={busqueda}
          onChange={(e) => setBusqueda(e.currentTarget.value)}
          w={{ base: '100%', sm: 320 }}
        />
        <Select
          data={[
            { value: 'todos', label: 'Todos los roles' },
            { value: 'admin', label: 'Administradores' },
            { value: 'cliente', label: 'Clientes' },
            { value: 'sin_rol', label: 'Sin rol asignado' },
          ]}
          value={filtroRol}
          onChange={(v) => setFiltroRol(v ?? 'todos')}
          w={{ base: '100%', sm: 200 }}
        />
      </Group>

      <Card padding={0}>
        <Table.ScrollContainer minWidth={760}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Correo</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Actualizado</Table.Th>
                <Table.Th w={170}>Rol</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filas.map((f) => (
                <Table.Tr key={f.user_id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {f.nombre ?? 'Sin nombre registrado'}
                    </Text>
                    <Text size="xs" ff="monospace" c="dimmed" style={{ wordBreak: 'break-all' }}>
                      {f.user_id}
                    </Text>
                    {f.user_id === perfil?.sub && (
                      <Badge size="xs" variant="light" mt={4}>
                        tu cuenta
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{f.email ?? '—'}</Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      variant="light"
                      color={f.rol ? 'teal' : 'gray'}
                    >
                      {f.estado}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{f.actualizado ? fechaHora(f.actualizado) : '—'}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Select
                        data={['admin', 'cliente']}
                        value={f.rol}
                        placeholder="sin rol"
                        onChange={(v) => v && asignar(f.user_id, v)}
                        size="xs"
                      />
                      <Tooltip label="Eliminar cuenta">
                        <ActionIcon
                          variant="light"
                          color="red"
                          disabled={f.user_id === perfil?.sub}
                          onClick={() => setAEliminar(f)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {filas.length === 0 && (
          <EstadoVacio
            titulo="Sin usuarios para mostrar"
            descripcion="Aparecerán aquí las cuentas que inicien sesión o a las que asignes un rol con su identificador (sub) de Supabase."
          />
        )}
      </Card>

      <Card padding={0}>
        <Group justify="space-between" p="md">
          <Text fw={600}>Invitaciones</Text>
          <Badge variant="light" color="gray">
            {invitaciones.length} registro(s)
          </Badge>
        </Group>
        {invitaciones.length === 0 ? (
          <EstadoVacio
            titulo="Sin invitaciones"
            descripcion="Las invitaciones que envíes aparecerán aquí con su estado y vigencia."
          />
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Correo</Table.Th>
                  <Table.Th>Rol</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Expira</Table.Th>
                  <Table.Th w={80}>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invitaciones.map((inv) => (
                  <Table.Tr key={inv.id}>
                    <Table.Td>{inv.email}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light">
                        {inv.rol}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={COLOR_INVITACION[inv.estado] ?? 'gray'}
                      >
                        {inv.estado}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{fechaHora(inv.expira_en)}</Table.Td>
                    <Table.Td>
                      {inv.estado === 'pendiente' && (
                        <Tooltip label="Revocar invitación">
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => void revocar(inv.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Modal
        opened={modalInvitar}
        onClose={invitarModal.close}
        title="Invitar usuario"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            La persona recibirá un correo del proveedor de identidad con un
            enlace de un solo uso para crear su contraseña. La invitación expira
            en 72 horas y el rol se asigna en el servidor al aceptarla.
          </Text>
          <TextInput
            label="Correo electrónico"
            placeholder="nombre@correo.com"
            value={correoInvitar}
            onChange={(e) => setCorreoInvitar(e.currentTarget.value)}
          />
          <Select
            label="Rol al aceptar"
            data={['admin', 'cliente']}
            value={rolInvitar}
            onChange={(v) => setRolInvitar(v ?? 'cliente')}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={invitarModal.close}>
              Cancelar
            </Button>
            <Button onClick={invitar} loading={invitando}>
              Enviar invitación
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={aEliminar !== null}
        onClose={() => setAEliminar(null)}
        title="Eliminar cuenta"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Se eliminará la cuenta
            {aEliminar?.email ? ` de ${aEliminar.email}` : ''} del proveedor de
            identidad y sus datos personales locales. Los pedidos y movimientos
            históricos se conservan para auditoría. Esta acción no puede
            deshacerse.
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setAEliminar(null)}>
              Cancelar
            </Button>
            <Button color="red" onClick={eliminarCuenta} loading={eliminando}>
              Eliminar definitivamente
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={abierto} onClose={close} title="Asignar rol a un usuario" centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Copia el identificador del usuario desde Supabase, en Authentication
            y la sección de usuarios.
          </Text>
          <TextInput
            label="Identificador del usuario (sub)"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={nuevoSub}
            onChange={(e) => setNuevoSub(e.currentTarget.value)}
          />
          <Select
            label="Rol"
            data={['admin', 'cliente']}
            value={nuevoRol}
            onChange={(v) => setNuevoRol(v ?? 'cliente')}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={agregar} loading={guardando}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
