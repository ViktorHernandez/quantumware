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
  NumberInput,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconEdit,
  IconShoppingCartPlus,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/authEstado';
import { useCarrito, MAX_POR_PRODUCTO } from '../carrito/carritoEstado';
import { EstadoVacio } from '../components/EstadoVacio';
import { ResenasProducto } from '../components/ResenasProducto';
import { nombreComercial } from '../utils/textoCatalogo';
import { fechaHora, moneda, identificadorCorto } from '../utils/formato';
import {
  rutaImagenProducto,
  imagenPlaceholder,
} from '../utils/imagenProducto';

interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  precio: string;
  stock: number;
  stock_minimo: number;
  estado: string;
  imagen_url: string | null;
}

interface Movimiento {
  id: string;
  tipo: string;
  cantidad: number;
  stock_resultante: number;
  motivo: string | null;
  fecha: string;
}

const COLOR_TIPO: Record<string, string> = {
  entrada: 'teal',
  salida: 'orange',
  ajuste: 'gray',
};

export function ProductoDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { esAdmin } = useAuth();
  const { agregar } = useCarrito();
  const [producto, setProducto] = useState<Producto | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cantidad, setCantidad] = useState<number>(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    let vigente = true;
    const cargar = async () => {
      const r = await apiFetch<Producto>(`/productos/${id}`);
      if (!vigente) {
        return;
      }
      setCargando(false);
      if (!r.ok || !r.data) {
        setError(r.mensaje ?? 'No se pudo cargar el producto.');
        return;
      }
      setProducto(r.data);
      if (!esAdmin) {
        return;
      }
      const m = await apiFetch<{ items: Movimiento[] }>(
        `/movimientos?producto_id=${id}&tamano=50`,
      );
      if (vigente && m.ok && m.data) {
        setMovimientos(m.data.items);
      }
    };
    void cargar();
    return () => {
      vigente = false;
    };
  }, [id, esAdmin]);

  if (cargando) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (error || !producto) {
    return (
      <Stack gap="md">
        <Alert color="red" icon={<IconAlertTriangle size={18} />}>
          {error ?? 'Producto no disponible.'}
        </Alert>
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/u/productos')}
          w="fit-content"
        >
          Volver al catálogo
        </Button>
      </Stack>
    );
  }

  const nombre = nombreComercial(producto.nombre);
  const descripcion = nombreComercial(producto.descripcion) || 'Sin descripción';
  const archivado = producto.estado === 'archivado';
  const agotado = producto.stock === 0;
  const bajo = !agotado && producto.stock <= producto.stock_minimo;
  const disponibleCliente = !archivado && !agotado;
  const maximo = Math.max(1, Math.min(producto.stock, MAX_POR_PRODUCTO));

  const agregarAlCarrito = (irAlCarrito: boolean) => {
    if (!disponibleCliente) {
      return;
    }
    const unidades = Math.min(Math.max(1, cantidad), maximo);
    agregar(
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        categoria: producto.categoria,
        imagen_url: producto.imagen_url,
      },
      unidades,
    );
    notifications.show({
      color: 'teal',
      message: `Se agregó ${unidades} unidad(es) de ${nombre} al carrito.`,
    });
    if (irAlCarrito) {
      navigate('/u/carrito');
    }
  };

  const estadoDisponibilidad = () => {
    if (archivado) {
      return (
        <Badge color="gray" variant="light" size="lg">
          No disponible
        </Badge>
      );
    }
    if (agotado) {
      return (
        <Badge color="red" variant="light" size="lg">
          Agotado
        </Badge>
      );
    }
    if (producto.stock <= 5) {
      return (
        <Badge color="orange" variant="light" size="lg">
          Pocas unidades ({producto.stock} disponibles)
        </Badge>
      );
    }
    return (
      <Badge color="teal" variant="light" size="lg">
        En stock
      </Badge>
    );
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/u/productos')}
          px={4}
        >
          Volver al catálogo
        </Button>
        {esAdmin && (
          <Button
            variant="light"
            leftSection={<IconEdit size={16} />}
            onClick={() => navigate('/u/productos')}
          >
            Editar en catálogo
          </Button>
        )}
      </Group>

      <Grid gap="xl">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder padding="md">
            <Image
              src={rutaImagenProducto(producto.nombre, producto.imagen_url)}
              fallbackSrc={imagenPlaceholder(producto.nombre, producto.categoria)}
              alt={`Fotografía de ${nombre}`}
              fit="contain"
              h={360}
              bg="gray.0"
              radius="sm"
            />
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            <div>
              <Group gap="sm" mb={4}>
                {producto.categoria && (
                  <Badge variant="light">{producto.categoria}</Badge>
                )}
                {archivado && (
                  <Badge color="gray" variant="outline">
                    Archivado
                  </Badge>
                )}
              </Group>
              <Title order={2}>{nombre}</Title>
            </div>

            <Text fz={30} fw={700}>
              {moneda(producto.precio)}
            </Text>

            <Group gap="sm">
              {estadoDisponibilidad()}
              {esAdmin && (
                <Badge variant="light" color={bajo ? 'red' : 'gray'}>
                  {producto.stock} en inventario
                </Badge>
              )}
            </Group>

            <Text c="dimmed">{descripcion}</Text>

            {archivado && (
              <Alert color="gray" icon={<IconAlertTriangle size={18} />}>
                Este producto se retiró del catálogo y no está disponible para
                compra.
              </Alert>
            )}

            {!esAdmin && disponibleCliente && (
              <Card withBorder padding="md">
                <Group align="flex-end" gap="md" wrap="wrap">
                  <NumberInput
                    label="Cantidad"
                    value={cantidad}
                    onChange={(v) => setCantidad(Number(v) || 1)}
                    min={1}
                    max={maximo}
                    clampBehavior="strict"
                    w={120}
                  />
                  <Button
                    leftSection={<IconShoppingCartPlus size={18} />}
                    onClick={() => agregarAlCarrito(false)}
                  >
                    Agregar al carrito
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => agregarAlCarrito(true)}
                  >
                    Comprar ahora
                  </Button>
                </Group>
                <Text size="xs" c="dimmed" mt="xs">
                  Máximo {maximo} unidad(es) por pedido. La disponibilidad se
                  confirma al finalizar la compra.
                </Text>
              </Card>
            )}

            {!esAdmin && !disponibleCliente && !archivado && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                Este producto no tiene existencias por el momento.
              </Alert>
            )}

            <Divider label="Especificaciones" labelPosition="left" />
            <Table withRowBorders={false} verticalSpacing={4}>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td c="dimmed" w={180}>
                    Categoría
                  </Table.Td>
                  <Table.Td>{producto.categoria ?? 'General'}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td c="dimmed">Disponibilidad</Table.Td>
                  <Table.Td>
                    {archivado
                      ? 'Retirado del catálogo'
                      : agotado
                        ? 'Sin existencias'
                        : 'Disponible'}
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td c="dimmed">Código</Table.Td>
                  <Table.Td>{identificadorCorto(producto.id)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Stack>
        </Grid.Col>
      </Grid>

      {esAdmin && (
        <Card padding={0} withBorder>
          <Group justify="space-between" p="md">
            <Text fw={600}>Historial de movimientos</Text>
            <Badge variant="light" color="gray">
              {movimientos.length} registro(s)
            </Badge>
          </Group>
          {movimientos.length === 0 ? (
            <EstadoVacio
              titulo="Sin movimientos"
              descripcion="Este producto todavía no tiene movimientos de inventario registrados."
            />
          ) : (
            <Table.ScrollContainer minWidth={640}>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Cantidad</Table.Th>
                    <Table.Th>Existencias resultantes</Table.Th>
                    <Table.Th>Motivo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {movimientos.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>{fechaHora(m.fecha)}</Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={COLOR_TIPO[m.tipo] ?? 'gray'}
                        >
                          {m.tipo}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{m.cantidad}</Table.Td>
                      <Table.Td>{m.stock_resultante}</Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {m.motivo ?? '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Card>
      )}

      <Divider />
      <ResenasProducto productoId={producto.id} />
    </Stack>
  );
}
