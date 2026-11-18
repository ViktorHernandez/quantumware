import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowsExchange, IconPlus } from '@tabler/icons-react';
import { apiFetch, type RespuestaApi } from '../api/client';
import { EstadoVacio } from '../components/EstadoVacio';
import { fechaHora } from '../utils/formato';

interface Movimiento {
  id: string;
  producto_id: string;
  nombre: string | null;
  tipo: string;
  cantidad: number;
  stock_resultante: number;
  motivo: string | null;
  fecha: string;
}

interface Pagina {
  items: Movimiento[];
  total: number;
  pagina: number;
  tamano: number;
}

interface ProductoOpcion {
  id: string;
  nombre: string;
  stock: number;
}

const TAMANO = 10;

const COLOR_TIPO: Record<string, string> = {
  entrada: 'teal',
  salida: 'orange',
  ajuste: 'gray',
};

export function InventarioPage() {
  const [datos, setDatos] = useState<Pagina | null>(null);
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [tipo, setTipo] = useState<string | null>(null);
  const [productoFiltro, setProductoFiltro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [abierto, { open, close }] = useDisclosure(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    producto_id: null as string | null,
    tipo: 'entrada',
    cantidad: 1 as number | string,
    motivo: '',
  });

  const consultar = useCallback(() => {
    const busqueda = new URLSearchParams();
    busqueda.set('pagina', String(pagina));
    busqueda.set('tamano', String(TAMANO));
    if (tipo) busqueda.set('tipo', tipo);
    if (productoFiltro) busqueda.set('producto_id', productoFiltro);
    return apiFetch<Pagina>(`/movimientos?${busqueda.toString()}`);
  }, [pagina, tipo, productoFiltro]);

  const aplicar = useCallback((r: RespuestaApi<Pagina>) => {
    if (r.ok && r.data) {
      setDatos(r.data);
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudieron cargar los movimientos.',
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

  const registrar = async () => {
    if (!form.producto_id) {
      notifications.show({ color: 'yellow', message: 'Selecciona un producto.' });
      return;
    }
    const cantidad = Number(form.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      notifications.show({ color: 'yellow', message: 'La cantidad debe ser un entero mayor que cero.' });
      return;
    }
    setGuardando(true);
    const r = await apiFetch('/movimientos', {
      metodo: 'POST',
      cuerpo: {
        producto_id: form.producto_id,
        tipo: form.tipo,
        cantidad,
        motivo: form.motivo.trim() || undefined,
      },
    });
    setGuardando(false);
    if (r.ok) {
      notifications.show({ color: 'teal', message: 'Movimiento registrado.' });
      close();
      setForm({ producto_id: null, tipo: 'entrada', cantidad: 1, motivo: '' });
      void cargar();
      void apiFetch<ProductoOpcion[]>('/productos').then((res) => {
        if (res.ok && Array.isArray(res.data)) {
          setProductos(res.data);
        }
      });
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo registrar el movimiento.',
      });
    }
  };

  const items = datos?.items ?? [];
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Movimientos de inventario</Title>
          <Text c="dimmed" size="sm">
            Entradas, salidas y ajustes que modifican las existencias
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Registrar movimiento
        </Button>
      </Group>

      <Card padding="md">
        <Group align="flex-end">
          <Select
            label="Tipo"
            placeholder="Todos"
            data={['entrada', 'salida', 'ajuste']}
            value={tipo}
            onChange={(v) => {
              setTipo(v);
              setPagina(1);
            }}
            clearable
            w={180}
          />
          <Select
            label="Producto"
            placeholder="Todos"
            data={productos.map((p) => ({ value: p.id, label: p.nombre }))}
            value={productoFiltro}
            onChange={(v) => {
              setProductoFiltro(v);
              setPagina(1);
            }}
            clearable
            searchable
            w={280}
          />
        </Group>
      </Card>

      <Card padding={0}>
        <Table.ScrollContainer minWidth={720}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Producto</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Cantidad</Table.Th>
                <Table.Th>Existencias resultantes</Table.Th>
                <Table.Th>Motivo</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td>{fechaHora(m.fecha)}</Table.Td>
                  <Table.Td>{m.nombre ?? '—'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={COLOR_TIPO[m.tipo] ?? 'gray'}>
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
        {items.length === 0 && (
          <EstadoVacio
            titulo="Sin movimientos registrados"
            descripcion="Registra una entrada o una salida para comenzar el historial de inventario."
            accion={
              <Button
                variant="light"
                leftSection={<IconArrowsExchange size={16} />}
                onClick={open}
                mt="sm"
              >
                Registrar movimiento
              </Button>
            }
          />
        )}
        {totalPaginas > 1 && (
          <Group justify="flex-end" p="md">
            <Pagination value={pagina} onChange={setPagina} total={totalPaginas} size="sm" />
          </Group>
        )}
      </Card>

      <Modal opened={abierto} onClose={close} title="Registrar movimiento" centered>
        <Stack gap="sm">
          <Select
            label="Producto"
            withAsterisk
            placeholder="Selecciona un producto"
            data={productos.map((p) => ({
              value: p.id,
              label: `${p.nombre} (existencias: ${p.stock})`,
            }))}
            value={form.producto_id}
            onChange={(v) => setForm({ ...form, producto_id: v })}
            searchable
          />
          <Select
            label="Tipo de movimiento"
            data={[
              { value: 'entrada', label: 'Entrada (suma al inventario)' },
              { value: 'salida', label: 'Salida (resta del inventario)' },
              { value: 'ajuste', label: 'Ajuste (fija las existencias)' },
            ]}
            value={form.tipo}
            onChange={(v) => setForm({ ...form, tipo: v ?? 'entrada' })}
          />
          <NumberInput
            label="Cantidad"
            min={1}
            allowDecimal={false}
            value={form.cantidad}
            onChange={(v) => setForm({ ...form, cantidad: v })}
          />
          <TextInput
            label="Motivo"
            maxLength={200}
            placeholder="Recepción de proveedor, merma, conteo físico"
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={registrar} loading={guardando}>
              Registrar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
