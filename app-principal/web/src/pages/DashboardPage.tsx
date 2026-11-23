import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCash,
  IconClipboardList,
  IconPackage,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/authEstado';
import { Kpi } from '../components/Kpi';
import { Barras, Donut } from '../components/Graficos';
import { BadgeEstado } from '../components/BadgeEstado';
import { EstadoVacio } from '../components/EstadoVacio';
import { fechaHora, identificadorCorto, moneda } from '../utils/formato';

interface Resumen {
  rol: string;
  productos?: number;
  unidadesEnInventario?: number;
  valorInventario?: string;
  productosStockBajo?: number;
  totalPedidos?: number;
  importeTotalPedidos?: string;
  misPedidos?: number;
  miImporteTotal?: string;
  productosEnCatalogo?: number;
  pedidosPorEstado: { estado: string; n: number }[];
  alertasStockBajo?: {
    id: string;
    nombre: string;
    categoria: string | null;
    stock: number;
    stock_minimo: number;
  }[];
  topProductos?: { id: string; nombre: string; unidades: number; importe: string }[];
  pedidosRecientes: { id: string; fecha: string; estado: string; total: string }[];
  movimientosRecientes?: {
    id: string;
    tipo: string;
    cantidad: number;
    stock_resultante: number;
    fecha: string;
    nombre: string | null;
  }[];
  seriePedidos: { dia: string; n: number }[];
}

export function DashboardPage() {
  const { esAdmin, perfil } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rango, setRango] = useState('7d');
  const [serieRango, setSerieRango] = useState<
    { etiqueta: string; valor: number }[]
  >([]);
  const [cargandoSerie, setCargandoSerie] = useState(true);
  const [errorSerie, setErrorSerie] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Resumen>('/dashboard').then((r) => {
      setCargando(false);
      if (r.ok && r.data) {
        setDatos(r.data);
      } else {
        setError(r.mensaje ?? 'No se pudo cargar el panel.');
      }
    });
  }, []);

  useEffect(() => {
    let vigente = true;
    const cargarSerie = async () => {
      setCargandoSerie(true);
      setErrorSerie(null);
      const r = await apiFetch<{
        rango: string;
        puntos: { etiqueta: string; n: number }[];
      }>(`/dashboard/serie-pedidos?rango=${rango}`);
      if (!vigente) {
        return;
      }
      setCargandoSerie(false);
      if (r.ok && r.data) {
        setSerieRango(
          r.data.puntos.map((p) => ({ etiqueta: p.etiqueta, valor: p.n })),
        );
      } else {
        setErrorSerie(r.mensaje ?? 'No se pudo cargar la serie de pedidos.');
      }
    };
    void cargarSerie();
    return () => {
      vigente = false;
    };
  }, [rango]);

  if (cargando) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (error || !datos) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={18} />}>
        {error ?? 'No se pudo cargar el panel.'}
      </Alert>
    );
  }

  const estados = (
    Array.isArray(datos.pedidosPorEstado) ? datos.pedidosPorEstado : []
  ).map((e) => ({ etiqueta: e.estado, valor: e.n }));

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Panel de control</Title>
        <Text c="dimmed" size="sm">
          Resumen de {esAdmin ? 'la operación de inventario y pedidos' : 'tu actividad'}
          {perfil?.nombre ? `, ${perfil.nombre}` : ''}
        </Text>
      </div>

      <Grid>
        {esAdmin ? (
          <>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <Kpi
                etiqueta="Productos"
                valor={datos.productos ?? 0}
                detalle={`${datos.unidadesEnInventario ?? 0} unidades en existencia`}
                icono={<IconPackage size={20} />}
                onClick={() => navigate('/u/productos')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <Kpi
                etiqueta="Valor del inventario"
                valor={moneda(datos.valorInventario)}
                icono={<IconCash size={20} />}
                color="teal"
                onClick={() => navigate('/u/analisis')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <Kpi
                etiqueta="Existencias bajas"
                valor={datos.productosStockBajo ?? 0}
                detalle="Productos en o por debajo del mínimo"
                icono={<IconAlertTriangle size={20} />}
                color={datos.productosStockBajo ? 'red' : 'gray'}
                onClick={() => navigate('/u/productos?stockBajo=true')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <Kpi
                etiqueta="Pedidos"
                valor={datos.totalPedidos ?? 0}
                detalle={`${moneda(datos.importeTotalPedidos)} acumulado`}
                icono={<IconClipboardList size={20} />}
                color="violet"
                onClick={() => navigate('/u/pedidos?todos=true')}
              />
            </Grid.Col>
          </>
        ) : (
          <>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Kpi
                etiqueta="Mis pedidos"
                valor={datos.misPedidos ?? 0}
                icono={<IconClipboardList size={20} />}
                onClick={() => navigate('/u/pedidos')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Kpi
                etiqueta="Importe acumulado"
                valor={moneda(datos.miImporteTotal)}
                icono={<IconCash size={20} />}
                color="teal"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Kpi
                etiqueta="Productos en catálogo"
                valor={datos.productosEnCatalogo ?? 0}
                icono={<IconPackage size={20} />}
                color="violet"
                onClick={() => navigate('/u/productos')}
              />
            </Grid.Col>
          </>
        )}
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card>
            <Group justify="space-between" mb="md" wrap="wrap">
              <Text fw={600}>Pedidos por periodo</Text>
              <Badge variant="light" leftSection={<IconTrendingUp size={12} />}>
                {serieRango.reduce((s, d) => s + d.valor, 0)} en total
              </Badge>
            </Group>
            <SegmentedControl
              size="xs"
              mb="md"
              value={rango}
              onChange={setRango}
              data={[
                { label: 'Hoy', value: '1d' },
                { label: '7 días', value: '7d' },
                { label: '30 días', value: '30d' },
                { label: '90 días', value: '90d' },
              ]}
            />
            {cargandoSerie ? (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            ) : errorSerie ? (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                {errorSerie}
              </Alert>
            ) : serieRango.every((d) => d.valor === 0) ? (
              <Center py="xl">
                <Text size="sm" c="dimmed">
                  No hay pedidos registrados en este periodo.
                </Text>
              </Center>
            ) : (
              <Barras datos={serieRango} />
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card>
            <Text fw={600} mb="md">
              Pedidos por estado
            </Text>
            <Donut datos={estados} />
          </Card>
        </Grid.Col>
      </Grid>

      {esAdmin && (
        <Grid>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card>
              <Text fw={600} mb="sm">
                Alertas de existencias bajas
              </Text>
              {datos.alertasStockBajo && datos.alertasStockBajo.length > 0 ? (
                <Table highlightOnHover className="qw-tabla-clicable">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Producto</Table.Th>
                      <Table.Th>Existencias</Table.Th>
                      <Table.Th>Mínimo</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {datos.alertasStockBajo.map((p) => (
                      <Table.Tr
                        key={p.id}
                        onClick={() => navigate('/u/productos?stockBajo=true')}
                      >
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {p.nombre}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {p.categoria ?? 'Sin categoría'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color="red" variant="light">
                            {p.stock}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{p.stock_minimo}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <EstadoVacio
                  titulo="Sin alertas"
                  descripcion="Ningún producto está en o por debajo de su nivel mínimo."
                />
              )}
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card>
              <Text fw={600} mb="sm">
                Productos más pedidos
              </Text>
              {datos.topProductos && datos.topProductos.length > 0 ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Producto</Table.Th>
                      <Table.Th>Unidades</Table.Th>
                      <Table.Th>Importe</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {datos.topProductos.map((p) => (
                      <Table.Tr
                        key={p.id}
                        onClick={() => navigate(`/u/productos/${p.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Table.Td>{p.nombre}</Table.Td>
                        <Table.Td>{p.unidades}</Table.Td>
                        <Table.Td>{moneda(p.importe)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <EstadoVacio
                  titulo="Todavía no hay pedidos"
                  descripcion="Cuando se registren pedidos aparecerán aquí los productos más solicitados."
                />
              )}
            </Card>
          </Grid.Col>
        </Grid>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, lg: esAdmin ? 6 : 12 }}>
          <Card>
            <Text fw={600} mb="sm">
              {esAdmin ? 'Pedidos recientes' : 'Mis pedidos recientes'}
            </Text>
            {Array.isArray(datos.pedidosRecientes) && datos.pedidosRecientes.length > 0 ? (
              <Table highlightOnHover className="qw-tabla-clicable">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Pedido</Table.Th>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(datos.pedidosRecientes ?? []).map((p) => (
                    <Table.Tr
                      key={p.id}
                      onClick={() => navigate(`/u/pedidos/${p.id}`)}
                    >
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {identificadorCorto(p.id)}
                        </Text>
                      </Table.Td>
                      <Table.Td>{fechaHora(p.fecha)}</Table.Td>
                      <Table.Td>
                        <BadgeEstado estado={p.estado} />
                      </Table.Td>
                      <Table.Td>{moneda(p.total)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <EstadoVacio
                titulo="Sin pedidos registrados"
                descripcion="Los pedidos que se registren aparecerán en esta lista."
              />
            )}
          </Card>
        </Grid.Col>
        {esAdmin && (
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card>
              <Text fw={600} mb="sm">
                Movimientos de inventario recientes
              </Text>
              {datos.movimientosRecientes && datos.movimientosRecientes.length > 0 ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Producto</Table.Th>
                      <Table.Th>Tipo</Table.Th>
                      <Table.Th>Cantidad</Table.Th>
                      <Table.Th>Resultado</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {datos.movimientosRecientes.map((m) => (
                      <Table.Tr key={m.id}>
                        <Table.Td>{m.nombre ?? '—'}</Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            color={
                              m.tipo === 'entrada'
                                ? 'teal'
                                : m.tipo === 'salida'
                                  ? 'orange'
                                  : 'gray'
                            }
                          >
                            {m.tipo}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{m.cantidad}</Table.Td>
                        <Table.Td>{m.stock_resultante}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <EstadoVacio
                  titulo="Sin movimientos"
                  descripcion="Registra entradas o salidas desde la sección de Inventario."
                />
              )}
            </Card>
          </Grid.Col>
        )}
      </Grid>
    </Stack>
  );
}
