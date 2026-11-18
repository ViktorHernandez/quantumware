import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  Image,
  Loader,
  Select,
  Stack,
  Table,
  Text,
  Timeline,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCreditCard,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/authEstado';
import { fechaHora, identificadorCorto, moneda } from '../utils/formato';
import { nombreComercial } from '../utils/textoCatalogo';
import {
  imagenPlaceholder,
  rutaImagenProducto,
} from '../utils/imagenProducto';
import {
  ETAPAS,
  ETIQUETA_PAGO,
  colorPago,
  etiquetaEstado,
} from '../utils/pedidoEstados';

interface ItemPedido {
  producto_id: string;
  nombre: string | null;
  imagen_url?: string | null;
  cantidad: number;
  precio_unitario: string;
}

interface Evento {
  estado: string;
  nota: string | null;
  creado_en: string;
}

interface Pedido {
  id: string;
  cliente_sub: string;
  fecha: string;
  estado: string;
  estado_pago: string;
  numero_seguimiento: string | null;
  pagado_en: string | null;
  total: string;
  items: ItemPedido[];
  eventos: Evento[];
}

const ESTADOS_ADMIN = [
  'procesando',
  'preparando',
  'empaquetado',
  'listo_envio',
  'enviado',
  'en_transito',
  'en_reparto',
  'entregado',
  'cancelado',
  'devuelto',
];

export function PedidoDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { esAdmin } = useAuth();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    let vigente = true;
    const cargar = async () => {
      const r = await apiFetch<Pedido>(`/pedidos/${id}`);
      if (!vigente) {
        return;
      }
      setCargando(false);
      if (r.ok && r.data) {
        setPedido(r.data);
        setError(null);
      } else {
        setError(r.mensaje ?? 'No se pudo cargar el pedido.');
      }
    };
    void cargar();
    return () => {
      vigente = false;
    };
  }, [id]);

  const cambiarEstado = async (nuevo: string | null) => {
    if (!nuevo || !pedido) return;
    setCambiando(true);
    const r = await apiFetch<Pedido>(`/pedidos/${pedido.id}/estado`, {
      metodo: 'PATCH',
      cuerpo: { estado: nuevo },
    });
    setCambiando(false);
    if (r.ok && r.data) {
      setPedido(r.data);
      notifications.show({ color: 'teal', message: 'Estado actualizado.' });
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo cambiar el estado.',
      });
    }
  };

  if (cargando) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (error || !pedido) {
    return (
      <Stack gap="md">
        <Alert color="red" icon={<IconAlertTriangle size={18} />}>
          {error ?? 'Pedido no disponible.'}
        </Alert>
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/u/pedidos')}
          w="fit-content"
        >
          Volver a pedidos
        </Button>
      </Stack>
    );
  }

  const cancelado = pedido.estado === 'cancelado' || pedido.estado === 'devuelto';
  const indiceActual = ETAPAS.indexOf(pedido.estado);
  const fechaEtapa = (etapa: string) =>
    pedido.eventos.find((e) => e.estado === etapa)?.creado_en;
  const sinActualizacionesLogisticas =
    !cancelado && indiceActual <= ETAPAS.indexOf('pago_aprobado');

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Group gap="sm">
            <Title order={2}>Pedido {identificadorCorto(pedido.id)}</Title>
            <Badge variant="light" color={colorPago(pedido.estado_pago)}>
              {ETIQUETA_PAGO[pedido.estado_pago] ?? pedido.estado_pago}
            </Badge>
          </Group>
          <Text c="dimmed" size="sm">
            Registrado el {fechaHora(pedido.fecha)}
            {pedido.numero_seguimiento && ` · Seguimiento ${pedido.numero_seguimiento}`}
          </Text>
        </div>
        <Group>
          {!esAdmin && pedido.estado_pago === 'pendiente' && pedido.estado !== 'cancelado' && (
            <Button
              leftSection={<IconCreditCard size={16} />}
              onClick={() => navigate(`/u/pedidos/${pedido.id}/pagar`)}
            >
              Pagar
            </Button>
          )}
          {esAdmin && (
            <Select
              data={ESTADOS_ADMIN}
              placeholder="Cambiar estado"
              value={null}
              onChange={cambiarEstado}
              disabled={cambiando}
              w={180}
              aria-label="Cambiar estado del pedido"
            />
          )}
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/u/pedidos')}
          >
            Volver
          </Button>
        </Group>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card padding={0}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Producto</Table.Th>
                  <Table.Th>Precio unitario</Table.Th>
                  <Table.Th>Cantidad</Table.Th>
                  <Table.Th>Subtotal</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pedido.items.map((i, indice) => (
                  <Table.Tr key={`${i.producto_id}-${indice}`}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Image
                          src={rutaImagenProducto(i.nombre ?? '', i.imagen_url)}
                          fallbackSrc={imagenPlaceholder(i.nombre ?? '', null)}
                          w={44}
                          h={44}
                          fit="contain"
                          radius="sm"
                          bg="gray.0"
                          alt={`Fotografía de ${i.nombre ?? 'producto'}`}
                        />
                        <Text>{nombreComercial(i.nombre) || i.producto_id}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>{moneda(i.precio_unitario)}</Table.Td>
                    <Table.Td>{i.cantidad}</Table.Td>
                    <Table.Td>{moneda(Number(i.precio_unitario) * i.cantidad)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          <Card mt="lg">
            <Group gap="xs" mb="md">
              <IconTruckDelivery size={18} />
              <Text fw={600}>Seguimiento del pedido</Text>
            </Group>
            {cancelado ? (
              <Alert color="red">
                Este pedido está {etiquetaEstado(pedido.estado).toLowerCase()}.
              </Alert>
            ) : (
              <>
                {sinActualizacionesLogisticas && (
                  <Alert color="blue" mb="md">
                    Todavía no hay actualizaciones de seguimiento para este
                    pedido. Su estado actual es{' '}
                    <b>{etiquetaEstado(pedido.estado).toLowerCase()}</b>; las
                    etapas de envío se registrarán cuando ocurran.
                  </Alert>
                )}
                <Timeline active={indiceActual} bulletSize={20} lineWidth={2}>
                  {ETAPAS.map((etapa, i) => {
                    const fecha = fechaEtapa(etapa);
                    const completada = i < indiceActual;
                    const actual = i === indiceActual;
                    return (
                      <Timeline.Item
                        key={etapa}
                        title={etiquetaEstado(etapa)}
                        c={actual ? undefined : completada ? undefined : 'dimmed'}
                      >
                        {fecha ? (
                          <Text size="xs" c="dimmed">
                            {fechaHora(fecha)}
                          </Text>
                        ) : (
                          <Text size="xs" c="dimmed">
                            {completada
                              ? 'Etapa completada'
                              : actual
                                ? 'Etapa actual'
                                : 'Etapa pendiente'}
                          </Text>
                        )}
                        {actual && (
                          <Badge size="xs" variant="light" mt={4}>
                            Estado actual
                          </Badge>
                        )}
                      </Timeline.Item>
                    );
                  })}
                </Timeline>
              </>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card>
            <Text fw={600} mb="sm">
              Resumen
            </Text>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Estado
              </Text>
              <Text size="sm">{etiquetaEstado(pedido.estado)}</Text>
            </Group>
            <Group justify="space-between" mt={6}>
              <Text size="sm" c="dimmed">
                Pago
              </Text>
              <Text size="sm">{ETIQUETA_PAGO[pedido.estado_pago] ?? pedido.estado_pago}</Text>
            </Group>
            {pedido.pagado_en && (
              <Group justify="space-between" mt={6}>
                <Text size="sm" c="dimmed">
                  Pagado el
                </Text>
                <Text size="sm">{fechaHora(pedido.pagado_en)}</Text>
              </Group>
            )}
            <Divider my="sm" />
            <Group justify="space-between">
              <Text fw={600}>Total</Text>
              <Text fw={700} fz="lg">
                {moneda(pedido.total)}
              </Text>
            </Group>
            {esAdmin && (
              <>
                <Divider my="sm" />
                <Text size="xs" c="dimmed">
                  Identificador del cliente
                </Text>
                <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>
                  {pedido.cliente_sub}
                </Text>
              </>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
