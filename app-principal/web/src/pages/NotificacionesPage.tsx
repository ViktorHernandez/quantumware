import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBell,
  IconClipboardList,
  IconPackageOff,
  IconSearch,
  IconShieldLock,
  IconUserCog,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, type RespuestaApi } from '../api/client';
import { EstadoVacio } from '../components/EstadoVacio';
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

interface Pagina {
  items: Notificacion[];
  total: number;
  pagina: number;
  tamano: number;
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

const TIPOS = [
  { value: 'stock_bajo', label: 'Existencias bajas' },
  { value: 'stock_agotado', label: 'Agotados' },
  { value: 'pedido_nuevo', label: 'Pedidos nuevos' },
  { value: 'pedido_estado', label: 'Estados de pedido' },
  { value: 'rol_cambiado', label: 'Cambios de rol' },
];

const TAMANO = 15;

export function NotificacionesPage() {
  const navigate = useNavigate();
  const {
    revision,
    marcarLeida: marcarLeidaGlobal,
    marcarTodas: marcarTodasGlobal,
  } = useNotificaciones();
  const [datos, setDatos] = useState<Pagina | null>(null);
  const [filtro, setFiltro] = useState('todas');
  const [tipo, setTipo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [consultaBusqueda, setConsultaBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const consultar = useCallback(() => {
    const p = new URLSearchParams();
    p.set('pagina', String(pagina));
    p.set('tamano', String(TAMANO));
    if (filtro === 'noleidas') p.set('soloNoLeidas', 'true');
    if (tipo) p.set('tipo', tipo);
    if (consultaBusqueda) p.set('busqueda', consultaBusqueda);
    return apiFetch<Pagina>(`/notificaciones?${p.toString()}`);
  }, [pagina, filtro, tipo, consultaBusqueda]);

  const aplicar = useCallback((r: RespuestaApi<Pagina>) => {
    if (r.ok && r.data) {
      setDatos(r.data);
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    const cargarVigente = async () => {
      const r = await consultar();
      if (vigente) {
        aplicar(r);
      }
    };
    void cargarVigente();
    return () => {
      vigente = false;
    };
  }, [consultar, aplicar, revision]);

  const cargar = async () => {
    aplicar(await consultar());
  };

  const marcarLeida = async (n: Notificacion) => {
    if (!n.leida) {
      await marcarLeidaGlobal(n.id);
    }
    if (typeof n.datos?.producto_id === 'string') {
      navigate(`/u/productos/${n.datos.producto_id}`);
    } else if (typeof n.datos?.pedido_id === 'string') {
      navigate(`/u/pedidos/${n.datos.pedido_id}`);
    } else {
      void cargar();
    }
  };

  const marcarTodas = async () => {
    await marcarTodasGlobal();
    void cargar();
  };

  const items = datos?.items ?? [];
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Notificaciones</Title>
          <Text c="dimmed" size="sm">
            Avisos generados por eventos del sistema
          </Text>
        </div>
        <Button variant="light" onClick={marcarTodas}>
          Marcar todas como leídas
        </Button>
      </Group>

      <Card padding="md">
        <Group align="flex-end" justify="space-between">
          <Group align="flex-end">
            <SegmentedControl
              value={filtro}
              onChange={(v) => {
                setFiltro(v);
                setPagina(1);
              }}
              data={[
                { label: 'Todas', value: 'todas' },
                { label: 'No leídas', value: 'noleidas' },
              ]}
            />
            <Select
              label="Tipo"
              placeholder="Todos"
              data={TIPOS}
              value={tipo}
              onChange={(v) => {
                setTipo(v);
                setPagina(1);
              }}
              clearable
              w={200}
            />
          </Group>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConsultaBusqueda(busqueda);
              setPagina(1);
            }}
          >
            <TextInput
              placeholder="Buscar"
              leftSection={<IconSearch size={16} />}
              value={busqueda}
              onChange={(e) => setBusqueda(e.currentTarget.value)}
              w={240}
            />
          </form>
        </Group>
      </Card>

      <Card padding={0}>
        {items.length === 0 ? (
          <EstadoVacio
            titulo="Sin notificaciones"
            descripcion="No hay notificaciones que coincidan con los filtros."
          />
        ) : (
          <Stack gap={0}>
            {items.map((n) => {
              const conf = ICONO[n.tipo] ?? { icon: IconBell, color: 'gray' };
              const Icono = conf.icon;
              return (
                <UnstyledButton
                  key={n.id}
                  onClick={() => marcarLeida(n)}
                  style={{
                    padding: '14px 16px',
                    borderTop: '1px solid #f1f3f5',
                    background: n.leida ? undefined : '#f5f8ff',
                  }}
                >
                  <Group gap="md" wrap="nowrap" align="flex-start">
                    <ThemeIcon variant="light" color={conf.color} size={38} radius="xl">
                      <Icono size={18} />
                    </ThemeIcon>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs">
                        <Text fw={n.leida ? 500 : 700}>{n.titulo}</Text>
                        {!n.leida && (
                          <Badge size="xs" variant="light" color="blue">
                            nueva
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed">
                        {n.mensaje}
                      </Text>
                      <Text size="xs" c="dimmed" mt={2}>
                        {fechaHora(n.creada)}
                      </Text>
                    </div>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Stack>
        )}
        {totalPaginas > 1 && (
          <Group justify="flex-end" p="md">
            <Pagination value={pagina} onChange={setPagina} total={totalPaginas} size="sm" />
          </Group>
        )}
      </Card>
    </Stack>
  );
}
