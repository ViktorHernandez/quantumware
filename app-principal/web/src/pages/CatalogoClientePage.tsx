import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Pagination,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconSearch, IconShoppingCartPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useCarrito } from '../carrito/carritoEstado';
import { EstadoResultado } from '../components/EstadoResultado';
import { ErrorServidor } from './PaginasError';
import {
  rutaImagenProducto,
  imagenPlaceholder,
} from '../utils/imagenProducto';
import { nombreComercial } from '../utils/textoCatalogo';
import { moneda } from '../utils/formato';
import { IconZoomQuestion } from '@tabler/icons-react';

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

interface Pagina {
  items: Producto[];
  total: number;
  pagina: number;
  tamano: number;
}

export function CatalogoClientePage() {
  const navigate = useNavigate();
  const { agregar } = useCarrito();
  const [params, setParams] = useSearchParams();
  const [datos, setDatos] = useState<Pagina | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [orden, setOrden] = useState('nombre');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    const q = new URLSearchParams();
    if (busqueda.trim()) q.set('q', busqueda.trim());
    if (categoria) q.set('categoria', categoria);
    const [campo, dir] = orden.split(':');
    q.set('orden', campo);
    q.set('direccion', dir ?? 'asc');
    q.set('pagina', String(pagina));
    q.set('tamano', '12');
    const r = await apiFetch<Pagina>(`/productos?${q.toString()}`);
    if (r.ok && r.data) {
      setDatos(r.data);
      setError(false);
    } else {
      setError(true);
    }
    setCargando(false);
  }, [busqueda, categoria, orden, pagina]);

  useEffect(() => {
    void apiFetch<string[]>('/productos/categorias').then((r) => {
      if (r.ok && r.data) setCategorias(r.data);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void cargar(), 250);
    return () => clearTimeout(t);
  }, [cargar]);

  useEffect(() => {
    const q = busqueda.trim();
    setParams(q ? { q } : {}, { replace: true });
  }, [busqueda, setParams]);

  const items = datos?.items ?? [];
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1;

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Catálogo</Title>
        <Text c="dimmed" size="sm">
          Explora los productos disponibles y crea pedidos
        </Text>
      </div>

      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          label="Buscar"
          placeholder="Nombre del producto"
          leftSection={<IconSearch size={16} />}
          value={busqueda}
          onChange={(e) => {
            setPagina(1);
            setBusqueda(e.currentTarget.value);
          }}
          w={{ base: '100%', sm: 280 }}
        />
        <Select
          label="Categoría"
          placeholder="Todas"
          clearable
          data={categorias}
          value={categoria}
          onChange={(v) => {
            setPagina(1);
            setCategoria(v);
          }}
          w={{ base: '100%', sm: 200 }}
        />
        <Select
          label="Ordenar por"
          data={[
            { value: 'nombre:asc', label: 'Nombre (A-Z)' },
            { value: 'nombre:desc', label: 'Nombre (Z-A)' },
            { value: 'precio:asc', label: 'Precio (menor)' },
            { value: 'precio:desc', label: 'Precio (mayor)' },
          ]}
          value={orden}
          onChange={(v) => setOrden(v ?? 'nombre:asc')}
          w={{ base: '100%', sm: 180 }}
        />
      </Group>

      {error ? (
        <ErrorServidor onReintentar={() => void cargar()} />
      ) : cargando ? (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 4 }} spacing="lg">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={280} radius="md" />
          ))}
        </SimpleGrid>
      ) : items.length === 0 ? (
        <EstadoResultado
          icono={IconZoomQuestion}
          titulo="Sin resultados"
          descripcion="No encontramos productos con esos criterios. Prueba con otra búsqueda o quita los filtros."
          compacto
          acciones={[
            {
              etiqueta: 'Limpiar filtros',
              variante: 'light',
              onClick: () => {
                setBusqueda('');
                setCategoria(null);
                setPagina(1);
              },
            },
          ]}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: 4 }} spacing="lg">
          {items.map((p) => {
            const agotado = p.stock === 0;
            const bajo = !agotado && p.stock <= p.stock_minimo;
            return (
              <Card key={p.id} padding="md" withBorder>
                <Card.Section>
                  <Image
                    src={rutaImagenProducto(p.nombre, p.imagen_url)}
                    fallbackSrc={imagenPlaceholder(p.nombre, p.categoria)}
                    height={150}
                    fit="contain"
                    loading="lazy"
                    alt={`Fotografía de ${p.nombre}`}
                    bg="gray.0"
                  />
                </Card.Section>
                <Stack gap={6} mt="sm" style={{ flexGrow: 1 }}>
                  {p.categoria && (
                    <Text size="xs" c="marca.7" fw={600} tt="uppercase">
                      {p.categoria}
                    </Text>
                  )}
                  <Text fw={600} lineClamp={1}>
                    {nombreComercial(p.nombre)}
                  </Text>
                  {p.descripcion && (
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {nombreComercial(p.descripcion)}
                    </Text>
                  )}
                  <Group justify="space-between" mt="auto" pt="xs">
                    <Text fw={700} fz="lg">
                      {moneda(p.precio)}
                    </Text>
                    <Badge
                      variant="light"
                      color={agotado ? 'red' : bajo ? 'yellow' : 'teal'}
                    >
                      {agotado ? 'Agotado' : `${p.stock} disp.`}
                    </Badge>
                  </Group>
                </Stack>
                <Group mt="md" gap="xs" grow>
                  <Button
                    variant="light"
                    leftSection={<IconShoppingCartPlus size={16} />}
                    disabled={agotado}
                    onClick={() => {
                      agregar({
                        producto_id: p.id,
                        nombre: p.nombre,
                        precio: p.precio,
                        categoria: p.categoria,
                        imagen_url: p.imagen_url,
                      });
                      notifications.show({
                        color: 'teal',
                        message: `${nombreComercial(p.nombre)} agregado al carrito.`,
                      });
                    }}
                  >
                    Agregar
                  </Button>
                  <Button variant="default" onClick={() => navigate(`/u/productos/${p.id}`)}>
                    Ver
                  </Button>
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {totalPaginas > 1 && !cargando && (
        <Group justify="center">
          <Pagination value={pagina} onChange={setPagina} total={totalPaginas} />
        </Group>
      )}
    </Stack>
  );
}
