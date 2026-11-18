import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBell,
  IconClipboardList,
  IconPackageOff,
  IconShieldLock,
  IconUserCog,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useNotificaciones } from '../notificaciones/notificacionesEstado';
import { fechaHora } from '../utils/formato';

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  datos: Record<string, unknown>;
  leida: boolean;
  creada: string;
}

const ICONO: Record<string, { icon: typeof IconBell; color: string }> = {
  stock_bajo: { icon: IconAlertTriangle, color: 'orange' },
  stock_agotado: { icon: IconPackageOff, color: 'red' },
  pedido_nuevo: { icon: IconClipboardList, color: 'blue' },
  pedido_estado: { icon: IconClipboardList, color: 'violet' },
  rol_cambiado: { icon: IconUserCog, color: 'grape' },
  cuenta_actualizada: { icon: IconUserCog, color: 'teal' },
  seguridad: { icon: IconShieldLock, color: 'red' },
};

function destino(n: Notificacion): string | null {
  if (typeof n.datos?.producto_id === 'string') {
    return `/u/productos/${n.datos.producto_id}`;
  }
  if (typeof n.datos?.pedido_id === 'string') {
    return `/u/pedidos/${n.datos.pedido_id}`;
  }
  return null;
}

async function consultarRecientes(): Promise<Notificacion[] | null> {
  const r = await apiFetch<Notificacion[]>('/notificaciones/recientes');
  return r.ok && r.data ? r.data : null;
}

export function NotificacionesBoton() {
  const navigate = useNavigate();
  const { contador, revision, marcarLeida, marcarTodas } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Notificacion[]>([]);

  useEffect(() => {
    if (!abierto) {
      return;
    }
    let vigente = true;
    const cargar = async () => {
      const recientes = await consultarRecientes();
      if (vigente && recientes) {
        setItems(recientes);
      }
    };
    void cargar();
    return () => {
      vigente = false;
    };
  }, [abierto, revision]);

  const alternar = () => {
    setAbierto(!abierto);
  };

  const abrir = async (n: Notificacion) => {
    if (!n.leida) {
      await marcarLeida(n.id);
    }
    const d = destino(n);
    setAbierto(false);
    if (d) {
      navigate(d);
    } else {
      navigate('/u/notificaciones');
    }
  };

  const marcarTodasBell = async () => {
    await marcarTodas();
  };

  return (
    <Popover
      opened={abierto}
      onChange={setAbierto}
      position="bottom-end"
      width={360}
      shadow="md"
    >
      <Popover.Target>
        <Indicator
          disabled={contador === 0}
          label={contador > 99 ? '99+' : contador}
          size={16}
          color="red"
          offset={4}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={alternar}
            aria-label="Notificaciones"
          >
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="sm">
          <Text fw={600}>Notificaciones</Text>
          {contador > 0 && (
            <Button variant="subtle" size="compact-xs" onClick={marcarTodasBell}>
              Marcar todas
            </Button>
          )}
        </Group>
        <ScrollArea.Autosize mah={360}>
          {items.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              No tienes notificaciones.
            </Text>
          ) : (
            <Stack gap={0}>
              {items.map((n) => {
                const conf = ICONO[n.tipo] ?? { icon: IconBell, color: 'gray' };
                const Icono = conf.icon;
                return (
                  <UnstyledButton
                    key={n.id}
                    onClick={() => abrir(n)}
                    style={{
                      padding: '10px 12px',
                      borderTop: '1px solid #f1f3f5',
                      background: n.leida ? undefined : '#f5f8ff',
                    }}
                  >
                    <Group gap="sm" wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color={conf.color} size={32} radius="xl">
                        <Icono size={16} />
                      </ThemeIcon>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={n.leida ? 500 : 700} lineClamp={1}>
                          {n.titulo}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {n.mensaje}
                        </Text>
                        <Text size="xs" c="dimmed" mt={2}>
                          {fechaHora(n.creada)}
                        </Text>
                      </Box>
                      {!n.leida && <Badge size="xs" variant="filled" circle p={0} w={8} h={8} />}
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Stack>
          )}
        </ScrollArea.Autosize>
        <Box p="xs" style={{ borderTop: '1px solid #f1f3f5' }}>
          <Button
            variant="light"
            fullWidth
            size="xs"
            onClick={() => {
              setAbierto(false);
              navigate('/u/notificaciones');
            }}
          >
            Ver todas
          </Button>
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
