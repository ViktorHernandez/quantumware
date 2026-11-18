import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, type RespuestaApi } from '../api/client';
import { useAuth } from '../auth/authEstado';
import { BadgeEstado } from '../components/BadgeEstado';
import { EstadoVacio } from '../components/EstadoVacio';
import { fechaHora, identificadorCorto, moneda } from '../utils/formato';

const LIMITE_INTERFAZ = 10;
const TAMANO = 10;

interface ItemPedido {
  producto_id: string;
  nombre: string | null;
  cantidad: number;
  precio_unitario: string;
}

interface Pedido {
  id: string;
  cliente_sub: string;
  fecha: string;
  estado: string;
  total: string;
  items: ItemPedido[];
}

interface Pagina {
  items: Pedido[];
  total: number;
  pagina: number;
  tamano: number;
}

interface ProductoOpcion {
  id: string;
  nombre: string;
  precio: string;
}

interface LineaForm {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export function PedidosPage() {
  const { esAdmin } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState<Pagina | null>(null);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [estado, setEstado] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [abierto, { open, close }] = useDisclosure(false);
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState<number | string>(1);
  const [enviando, setEnviando] = useState(false);

  const consultar = useCallback(() => {
    const busqueda = new URLSearchParams();
    busqueda.set('pagina', String(pagina));
    busqueda.set('tamano', String(TAMANO));
    if (estado) busqueda.set('estado', estado);
    if (verTodos && esAdmin) busqueda.set('todos', 'true');
    return apiFetch<Pagina>(`/pedidos?${busqueda.toString()}`);
  }, [pagina, estado, verTodos, esAdmin]);

  const aplicar = useCallback((r: RespuestaApi<Pagina>) => {
    if (r.ok && r.data) {
      setDatos(r.data);
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudieron cargar los pedidos.',
      });
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
  }, [consultar, aplicar]);

  const cargar = async () => {
    aplicar(await consultar());
  };

  useEffect(() => {
    void apiFetch<ProductoOpcion[]>('/productos').then((r) => {
      if (r.ok && Array.isArray(r.data)) {
        setProductos(r.data);
      }
    });
  }, []);

  const agregarLinea = () => {
    const n = Number(cantidad);
    if (!seleccion) {
      notifications.show({ color: 'yellow', message: 'Selecciona un producto.' });
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > LIMITE_INTERFAZ) {
      notifications.show({
        color: 'yellow',
        message: `La cantidad debe estar entre 1 y ${LIMITE_INTERFAZ} unidades.`,
      });
      return;
    }
    const p = productos.find((x) => x.id === seleccion);
    if (!p) {
      return;
    }
    setLineas([
      ...lineas,
      { producto_id: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: n },
    ]);
    setSeleccion(null);
    setCantidad(1);
  };

  const totalEstimado = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);

  const registrar = async () => {
    if (lineas.length === 0) {
      notifications.show({ color: 'yellow', message: 'Agrega al menos un producto.' });
      return;
    }
    setEnviando(true);
    const r = await apiFetch('/pedidos', {
      metodo: 'POST',
      cuerpo: {
        items: lineas.map((l) => ({
          producto_id: l.producto_id,
          cantidad: l.cantidad,
        })),
      },
    });
    setEnviando(false);
    if (r.ok) {
      notifications.show({ color: 'teal', message: 'Pedido registrado.' });
      setLineas([]);
      close();
      void cargar();
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo registrar el pedido.',
      });
    }
  };

  const items = datos?.items ?? [];
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Pedidos</Title>
          <Text c="dimmed" size="sm">
            {datos?.total ?? 0} pedido(s) {verTodos ? 'en el sistema' : 'a tu nombre'}
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Nuevo pedido
        </Button>
      </Group>

      <Card padding="md">
        <Group align="flex-end">
          <Select
            label="Estado"
            placeholder="Todos"
            data={['registrado', 'confirmado', 'enviado', 'entregado', 'cancelado']}
            value={estado}
            onChange={(v) => {
              setEstado(v);
              setPagina(1);
            }}
            clearable
            w={200}
          />
          {esAdmin && (
            <Switch
              label="Ver pedidos de todos los clientes"
              checked={verTodos}
              onChange={(e) => {
                setVerTodos(e.currentTarget.checked);
                setPagina(1);
              }}
              mb={8}
            />
          )}
        </Group>
      </Card>

      <Card padding={0}>
        <Table.ScrollContainer minWidth={720}>
          <Table striped highlightOnHover className="qw-tabla-clicable">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pedido</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Líneas</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((p) => (
                <Table.Tr key={p.id} onClick={() => navigate(`/u/pedidos/${p.id}`)}>
                  <Table.Td>
                    <Text size="sm" ff="monospace" fw={500}>
                      {identificadorCorto(p.id)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{fechaHora(p.fecha)}</Table.Td>
                  <Table.Td>{p.items.length}</Table.Td>
                  <Table.Td>
                    <BadgeEstado estado={p.estado} />
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600}>{moneda(p.total)}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {items.length === 0 && (
          <EstadoVacio
            titulo="Sin pedidos"
            descripcion="Registra un pedido con los productos del catálogo para verlo aquí."
          />
        )}
        {totalPaginas > 1 && (
          <Group justify="flex-end" p="md">
            <Pagination value={pagina} onChange={setPagina} total={totalPaginas} size="sm" />
          </Group>
        )}
      </Card>

      <Modal opened={abierto} onClose={close} title="Nuevo pedido" centered size="lg">
        <Stack gap="sm">
          <Alert color="blue" icon={<IconInfoCircle size={18} />} p="xs">
            El formulario limita la cantidad a {LIMITE_INTERFAZ} unidades por
            producto. Esta restricción se aplica en el navegador.
          </Alert>
          <Group align="flex-end">
            <Select
              label="Producto"
              placeholder="Selecciona un producto"
              data={productos.map((p) => ({
                value: p.id,
                label: `${p.nombre} — ${moneda(p.precio)}`,
              }))}
              value={seleccion}
              onChange={setSeleccion}
              searchable
              style={{ flex: 1 }}
            />
            <NumberInput
              label="Cantidad"
              min={1}
              max={LIMITE_INTERFAZ}
              allowDecimal={false}
              value={cantidad}
              onChange={setCantidad}
              w={120}
            />
            <Button variant="light" onClick={agregarLinea}>
              Agregar
            </Button>
          </Group>

          {lineas.length > 0 && (
            <>
              <Table withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Producto</Table.Th>
                    <Table.Th>Precio</Table.Th>
                    <Table.Th>Cantidad</Table.Th>
                    <Table.Th>Subtotal</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lineas.map((l, i) => (
                    <Table.Tr key={`${l.producto_id}-${i}`}>
                      <Table.Td>{l.nombre}</Table.Td>
                      <Table.Td>{moneda(l.precio)}</Table.Td>
                      <Table.Td>{l.cantidad}</Table.Td>
                      <Table.Td>{moneda(l.precio * l.cantidad)}</Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => setLineas(lineas.filter((_, j) => j !== i))}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Divider />
              <Group justify="space-between">
                <Text fw={600}>Total estimado</Text>
                <Text fw={700} fz="lg">
                  {moneda(totalEstimado)}
                </Text>
              </Group>
            </>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={registrar} loading={enviando}>
              Registrar pedido
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
