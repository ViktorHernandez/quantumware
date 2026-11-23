import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconBell,
  IconClipboardList,
  IconLayoutDashboard,
  IconLogout,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { Button } from '@mantine/core';
import {
  NavLink as RouterNavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../auth/authEstado';
import { NotificacionesProvider } from '../notificaciones/NotificacionesProvider';
import { Marca } from './Marca';
import { NotificacionesBoton } from './NotificacionesBoton';

interface Enlace {
  ruta: string;
  etiqueta: string;
  icono: ReactNode;
}

const ENLACES_ADMIN: Enlace[] = [
  { ruta: '/u/panel', etiqueta: 'Panel', icono: <IconLayoutDashboard size={18} /> },
  { ruta: '/u/productos', etiqueta: 'Gestión de productos', icono: <IconPackage size={18} /> },
  {
    ruta: '/u/inventario',
    etiqueta: 'Inventario y movimientos',
    icono: <IconArrowsExchange size={18} />,
  },
  { ruta: '/u/pedidos', etiqueta: 'Pedidos de clientes', icono: <IconClipboardList size={18} /> },
  {
    ruta: '/u/usuarios',
    etiqueta: 'Usuarios y roles',
    icono: <IconUsers size={18} />,
  },
];

const ENLACES_CLIENTE: Enlace[] = [
  { ruta: '/u/panel', etiqueta: 'Inicio', icono: <IconLayoutDashboard size={18} /> },
  { ruta: '/u/productos', etiqueta: 'Catálogo', icono: <IconPackage size={18} /> },
  { ruta: '/u/carrito', etiqueta: 'Carrito', icono: <IconShoppingCart size={18} /> },
  { ruta: '/u/pedidos', etiqueta: 'Mis pedidos', icono: <IconClipboardList size={18} /> },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { perfil, esAdmin, cerrarSesion, errorPerfil, recargarPerfil } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [abierto, { toggle, close }] = useDisclosure(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  const salir = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/u/productos?q=${encodeURIComponent(busqueda)}`);
  };

  const iniciales = (perfil?.nombre || perfil?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <NotificacionesProvider>
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !abierto },
      }}
      padding="lg"
    >
      <AppShell.Header
        style={{ borderBottom: '1px solid #e6e8ee', background: '#ffffff' }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={abierto} onClick={toggle} hiddenFrom="sm" size="sm" />
            <form onSubmit={buscar}>
              <TextInput
                placeholder="Buscar productos"
                leftSection={<IconSearch size={16} />}
                value={busqueda}
                onChange={(e) => setBusqueda(e.currentTarget.value)}
                w={{ base: 160, sm: 320 }}
                size="sm"
              />
            </form>
          </Group>
          <Group gap="md" wrap="nowrap">
            <NotificacionesBoton />
            <Menu position="bottom-end" width={230}>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar color="marca" radius="xl" size={34}>
                      {iniciales}
                    </Avatar>
                    <div style={{ lineHeight: 1.2 }} className="qw-solo-sm">
                      <Text size="sm" fw={600} lineClamp={1}>
                        {perfil?.nombre || perfil?.email}
                      </Text>
                      <Text size="xs" c="dimmed" tt="capitalize">
                        {perfil?.rol ?? 'sin rol'}
                      </Text>
                    </div>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{perfil?.email}</Menu.Label>
                <Menu.Item
                  leftSection={<IconUser size={16} />}
                  onClick={() => navigate('/u/perfil')}
                >
                  Mi perfil
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconSettings size={16} />}
                  onClick={() => navigate('/u/ajustes')}
                >
                  Ajustes y seguridad
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={salir}
                >
                  Cerrar sesión
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar style={{ background: '#151c2e', border: 'none' }}>
        <AppShell.Section p="md">
          <Group gap="sm">
            <Marca />
            <div style={{ lineHeight: 1.1 }}>
              <Text c="white" fw={700} fz="md">
                QuantumWare
              </Text>
              <Text c="#8d97ad" fz={10} tt="uppercase" fw={600}>
                Inventario y pedidos
              </Text>
            </div>
          </Group>
        </AppShell.Section>
        <Divider color="#28324a" />
        <AppShell.Section grow component={ScrollArea} p="sm">
          {(esAdmin ? ENLACES_ADMIN : ENLACES_CLIENTE).map((e) => (
            <NavLink
              key={e.ruta}
              component={RouterNavLink}
              to={e.ruta}
              label={e.etiqueta}
              leftSection={e.icono}
              className="qw-nav-link"
              mb={4}
            />
          ))}
          <Divider my="sm" color="#28324a" />
          <NavLink
            component={RouterNavLink}
            to="/u/notificaciones"
            label="Notificaciones"
            leftSection={<IconBell size={18} />}
            className="qw-nav-link"
            mb={4}
          />
          <NavLink
            component={RouterNavLink}
            to="/u/perfil"
            label="Mi perfil"
            leftSection={<IconUser size={18} />}
            className="qw-nav-link"
            mb={4}
          />
          <NavLink
            component={RouterNavLink}
            to="/u/ajustes"
            label="Ajustes"
            leftSection={<IconSettings size={18} />}
            className="qw-nav-link"
          />
        </AppShell.Section>
        <AppShell.Section p="md">
          <Badge
            variant="light"
            color={esAdmin ? 'grape' : 'blue'}
            fullWidth
            size="sm"
          >
            {esAdmin ? 'Administrador' : (perfil?.rol ?? 'sin rol asignado')}
          </Badge>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {errorPerfil && (
          <Alert
            color="red"
            icon={<IconAlertTriangle size={18} />}
            mb="lg"
            title="No se pudo recuperar tu perfil"
          >
            <Group justify="space-between" align="center">
              <Text size="sm">
                Hubo un problema al leer tu perfil y rol desde el servidor. Esto
                no significa que hayas perdido tus permisos; es un fallo de
                lectura temporal.
              </Text>
              <Button
                size="xs"
                variant="white"
                color="red"
                leftSection={<IconRefresh size={14} />}
                onClick={() => void recargarPerfil()}
              >
                Reintentar
              </Button>
            </Group>
          </Alert>
        )}
        {perfil?.sinRolAsignado && (
          <Alert
            color="yellow"
            icon={<IconAlertTriangle size={18} />}
            mb="lg"
            title="Cuenta sin rol asignado"
          >
            Tu cuenta está autenticada pero todavía no tiene un rol en la tabla
            user_roles, por lo que el servidor denegará las operaciones. Un
            administrador debe asignarte un rol.
          </Alert>
        )}
        {children}
      </AppShell.Main>
    </AppShell>
    </NotificacionesProvider>
  );
}
