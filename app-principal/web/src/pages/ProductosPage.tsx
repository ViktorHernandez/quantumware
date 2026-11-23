import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArchive,
  IconArchiveOff,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/authEstado';
import { EstadoVacio } from '../components/EstadoVacio';
import { moneda } from '../utils/formato';
import { IMAGENES_CATALOGO } from '../utils/imagenesCatalogo';
import {
  rutaImagenProducto,
  imagenPlaceholder,
} from '../utils/imagenProducto';

interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  imagen_url: string | null;
  precio: string;
  stock: number;
  stock_minimo: number;
  estado: string;
}

interface Pagina {
  items: Producto[];
  total: number;
  pagina: number;
  tamano: number;
}

interface FormProducto {
  id: string | null;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number | string;
  stock: number | string;
  stock_minimo: number | string;
  imagen_url: string;
}

const FORM_VACIO: FormProducto = {
  id: null,
  nombre: '',
  descripcion: '',
  categoria: '',
  precio: 0,
  stock: 0,
  stock_minimo: 0,
  imagen_url: '',
};

const TAMANO = 10;

interface PropsEncabezadoOrdenable {
  campo: string;
  orden: string;
  direccion: 'asc' | 'desc';
  alOrdenar: (campo: string) => void;
  children: string;
}

function EncabezadoOrdenable({
  campo,
  orden,
  direccion,
  alOrdenar,
  children,
}: PropsEncabezadoOrdenable) {
  return (
    <Table.Th>
      <UnstyledButton onClick={() => alOrdenar(campo)}>
        <Group gap={4} wrap="nowrap">
          <Text size="sm" fw={600}>
            {children}
          </Text>
          {orden === campo &&
            (direccion === 'asc' ? (
              <IconChevronUp size={14} />
            ) : (
              <IconChevronDown size={14} />
            ))}
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

export function ProductosPage() {
  const { esAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [datos, setDatos] = useState<Pagina | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [recargas, setRecargas] = useState(0);
  const [peticionResuelta, setPeticionResuelta] = useState<string | null>(null);
  const [orden, setOrden] = useState('nombre');
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('asc');
  const [pagina, setPagina] = useState(1);
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [confirmar, setConfirmar] = useState<Producto | null>(null);
  const [form, setForm] = useState<FormProducto>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [erroresForm, setErroresForm] = useState<Record<string, string>>({});

  const categoria = params.get('categoria') ?? '';
  const stockBajo = params.get('stockBajo') === 'true';
  const q = params.get('q') ?? '';
  const [termino, setTermino] = useState(q);
  const [qAplicado, setQAplicado] = useState(q);

  if (q !== qAplicado) {
    setQAplicado(q);
    setTermino(q);
  }

  const consulta = useMemo(() => {
    const busqueda = new URLSearchParams();
    busqueda.set('pagina', String(pagina));
    busqueda.set('tamano', String(TAMANO));
    busqueda.set('orden', orden);
    busqueda.set('direccion', direccion);
    if (q) busqueda.set('q', q);
    if (categoria) busqueda.set('categoria', categoria);
    if (stockBajo) busqueda.set('stockBajo', 'true');
    return busqueda.toString();
  }, [pagina, orden, direccion, q, categoria, stockBajo]);

  const peticion = `${recargas}:${consulta}`;
  const cargando = peticionResuelta !== peticion;

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      const r = await apiFetch<Pagina>(`/productos?${consulta}`);
      if (!vigente) {
        return;
      }
      setPeticionResuelta(peticion);
      if (r.ok && r.data) {
        setDatos(r.data);
      } else {
        notifications.show({
          color: 'red',
          message: r.mensaje ?? 'No se pudo cargar el catálogo.',
        });
      }
    };
    void cargar();
    return () => {
      vigente = false;
    };
  }, [consulta, peticion]);

  const recargar = () => setRecargas((n) => n + 1);

  useEffect(() => {
    void apiFetch<string[]>('/productos/categorias').then((r) => {
      if (r.ok && r.data) {
        setCategorias(r.data);
      }
    });
  }, []);

  const actualizarParam = (clave: string, valor: string | null) => {
    const nuevos = new URLSearchParams(params);
    if (valor) {
      nuevos.set(clave, valor);
    } else {
      nuevos.delete(clave);
    }
    setParams(nuevos);
    setPagina(1);
  };

  const ordenarPor = (columna: string) => {
    if (orden === columna) {
      setDireccion(direccion === 'asc' ? 'desc' : 'asc');
    } else {
      setOrden(columna);
      setDireccion('asc');
    }
    setPagina(1);
  };

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setErroresForm({});
    open();
  };

  const abrirEdicion = (p: Producto) => {
    setForm({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      categoria: p.categoria ?? '',
      imagen_url: p.imagen_url ?? '',
      precio: Number(p.precio),
      stock: p.stock,
      stock_minimo: p.stock_minimo,
    });
    setErroresForm({});
    open();
  };

  const validarForm = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (form.nombre.length > 120) e.nombre = 'Máximo 120 caracteres.';
    if (Number(form.precio) < 0) e.precio = 'El precio no puede ser negativo.';
    if (Number(form.stock) < 0) e.stock = 'Las existencias no pueden ser negativas.';
    if (Number(form.stock_minimo) < 0) e.stock_minimo = 'El mínimo no puede ser negativo.';
    setErroresForm(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    if (!validarForm()) {
      return;
    }
    setGuardando(true);
    const cuerpo = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || undefined,
      categoria: form.categoria.trim() || undefined,
      precio: Number(form.precio),
      stock: Number(form.stock),
      stock_minimo: Number(form.stock_minimo),
      imagen_url: form.imagen_url || undefined,
    };
    const r = form.id
      ? await apiFetch<Producto>(`/productos/${form.id}`, {
          metodo: 'PUT',
          cuerpo,
        })
      : await apiFetch<Producto>('/productos', { metodo: 'POST', cuerpo });
    setGuardando(false);
    if (r.ok) {
      notifications.show({
        color: 'teal',
        message: form.id ? 'Producto actualizado.' : 'Producto creado.',
      });
      close();
      recargar();
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo guardar el producto.',
      });
    }
  };

  const eliminar = async () => {
    if (!confirmar) {
      return;
    }
    const r = await apiFetch(`/productos/${confirmar.id}`, { metodo: 'DELETE' });
    setConfirmar(null);
    if (r.ok) {
      notifications.show({ color: 'teal', message: 'Producto eliminado.' });
      recargar();
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo eliminar el producto.',
      });
    }
  };

  const cambiarEstado = async (p: Producto, accion: 'archivar' | 'reactivar') => {
    const r = await apiFetch(`/productos/${p.id}/${accion}`, { metodo: 'POST' });
    if (r.ok) {
      notifications.show({
        color: 'teal',
        message: accion === 'archivar' ? 'Producto archivado.' : 'Producto reactivado.',
      });
      recargar();
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo cambiar el estado del producto.',
      });
    }
  };

  const items = datos?.items ?? [];
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Productos e inventario</Title>
          <Text c="dimmed" size="sm">
            {datos?.total ?? 0} producto(s) en el catálogo
          </Text>
        </div>
        {esAdmin && (
          <Button leftSection={<IconPlus size={16} />} onClick={abrirNuevo}>
            Nuevo producto
          </Button>
        )}
      </Group>

      <Card padding="md">
        <Group align="flex-end" gap="md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              actualizarParam('q', termino || null);
            }}
          >
            <TextInput
              label="Buscar"
              placeholder="Nombre del producto"
              leftSection={<IconSearch size={16} />}
              value={termino}
              onChange={(e) => setTermino(e.currentTarget.value)}
              w={260}
            />
          </form>
          <Select
            label="Categoría"
            placeholder="Todas"
            data={categorias}
            value={categoria || null}
            onChange={(v) => actualizarParam('categoria', v)}
            clearable
            w={200}
          />
          <Switch
            label="Solo existencias bajas"
            checked={stockBajo}
            onChange={(e) =>
              actualizarParam('stockBajo', e.currentTarget.checked ? 'true' : null)
            }
            mb={8}
          />
          <Button
            variant="default"
            mb={1}
            onClick={() => {
              setTermino('');
              setParams(new URLSearchParams());
              setPagina(1);
            }}
          >
            Limpiar
          </Button>
        </Group>
      </Card>

      <Card padding={0}>
        <Table.ScrollContainer minWidth={760}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <EncabezadoOrdenable
                  campo="nombre"
                  orden={orden}
                  direccion={direccion}
                  alOrdenar={ordenarPor}
                >
                  Producto
                </EncabezadoOrdenable>
                <EncabezadoOrdenable
                  campo="categoria"
                  orden={orden}
                  direccion={direccion}
                  alOrdenar={ordenarPor}
                >
                  Categoría
                </EncabezadoOrdenable>
                <EncabezadoOrdenable
                  campo="precio"
                  orden={orden}
                  direccion={direccion}
                  alOrdenar={ordenarPor}
                >
                  Precio
                </EncabezadoOrdenable>
                <EncabezadoOrdenable
                  campo="stock"
                  orden={orden}
                  direccion={direccion}
                  alOrdenar={ordenarPor}
                >
                  Existencias
                </EncabezadoOrdenable>
                <Table.Th>Mínimo</Table.Th>
                {esAdmin && <Table.Th w={110}>Acciones</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((p) => {
                const bajo = p.stock <= p.stock_minimo;
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar
                          src={rutaImagenProducto(p.nombre, p.imagen_url)}
                          radius="md"
                          size={38}
                          imageProps={{
                            onError: (e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                imagenPlaceholder(p.nombre, p.categoria);
                            },
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm" fw={500} lineClamp={1}>
                              {p.nombre}
                            </Text>
                            {p.estado === 'archivado' && (
                              <Badge size="xs" color="gray" variant="light">
                                archivado
                              </Badge>
                            )}
                          </Group>
                          {p.descripcion && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {p.descripcion}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {p.categoria ? (
                        <Badge variant="light" color="gray">
                          {p.categoria}
                        </Badge>
                      ) : (
                        <Text c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>{moneda(p.precio)}</Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Text size="sm" fw={bajo ? 700 : 400} c={bajo ? 'red' : undefined}>
                          {p.stock}
                        </Text>
                        {bajo && (
                          <Tooltip label="En o por debajo del nivel mínimo">
                            <Badge
                              color="red"
                              variant="light"
                              leftSection={<IconAlertTriangle size={11} />}
                            >
                              bajo
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {p.stock_minimo}
                      </Text>
                    </Table.Td>
                    {esAdmin && (
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Tooltip label="Editar">
                            <ActionIcon variant="light" onClick={() => abrirEdicion(p)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {p.estado === 'archivado' ? (
                            <Tooltip label="Reactivar">
                              <ActionIcon
                                variant="light"
                                color="teal"
                                onClick={() => cambiarEstado(p, 'reactivar')}
                              >
                                <IconArchiveOff size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Tooltip label="Archivar">
                              <ActionIcon
                                variant="light"
                                color="orange"
                                onClick={() => cambiarEstado(p, 'archivar')}
                              >
                                <IconArchive size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          <Tooltip label="Eliminar">
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => setConfirmar(p)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {!cargando && items.length === 0 && (
          <EstadoVacio
            titulo="No hay productos que coincidan"
            descripcion="Ajusta los filtros de búsqueda o limpia los criterios aplicados."
          />
        )}
        {totalPaginas > 1 && (
          <Group justify="flex-end" p="md">
            <Pagination value={pagina} onChange={setPagina} total={totalPaginas} size="sm" />
          </Group>
        )}
      </Card>

      <Modal
        opened={modalAbierto}
        onClose={close}
        title={form.id ? 'Editar producto' : 'Nuevo producto'}
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Nombre"
            withAsterisk
            maxLength={120}
            value={form.nombre}
            error={erroresForm.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.currentTarget.value })}
          />
          <Textarea
            label="Descripción"
            autosize
            minRows={2}
            maxRows={5}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.currentTarget.value })}
          />
          <TextInput
            label="Categoría"
            maxLength={60}
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.currentTarget.value })}
          />
          <Select
            label="Imagen del producto"
            description="Selecciona la fotografía del catálogo que corresponde a este producto."
            placeholder="Sin imagen asignada"
            data={IMAGENES_CATALOGO.map((i) => ({
              value: i.valor,
              label: i.etiqueta,
            }))}
            value={form.imagen_url || null}
            onChange={(v) => setForm({ ...form, imagen_url: v ?? '' })}
            clearable
            searchable
          />
          <Group grow>
            <NumberInput
              label="Precio"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              prefix="$ "
              value={form.precio}
              error={erroresForm.precio}
              onChange={(v) => setForm({ ...form, precio: v })}
            />
            <NumberInput
              label="Existencias"
              min={0}
              allowDecimal={false}
              value={form.stock}
              error={erroresForm.stock}
              onChange={(v) => setForm({ ...form, stock: v })}
            />
            <NumberInput
              label="Mínimo"
              min={0}
              allowDecimal={false}
              value={form.stock_minimo}
              error={erroresForm.stock_minimo}
              onChange={(v) => setForm({ ...form, stock_minimo: v })}
            />
          </Group>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={guardar} loading={guardando}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={confirmar !== null}
        onClose={() => setConfirmar(null)}
        title="Confirmar eliminación"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Se eliminará el producto «{confirmar?.nombre}». Esta acción no se
            puede deshacer.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
            <Button color="red" onClick={eliminar}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
