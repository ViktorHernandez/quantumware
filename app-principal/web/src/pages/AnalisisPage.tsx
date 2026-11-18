import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft } from '@tabler/icons-react';
import { Button } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { Kpi } from '../components/Kpi';
import { IconCash, IconPackage, IconStack2 } from '@tabler/icons-react';
import { moneda } from '../utils/formato';

interface Categoria {
  categoria: string;
  productos: number;
  unidades: number;
  valor: string;
}

interface TopProducto {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: string;
  stock: number;
  valor: string;
}

interface Analisis {
  totalValor: string;
  totalUnidades: number;
  totalProductos: number;
  porCategoria: Categoria[];
  topProductos: TopProducto[];
}

const COLORES = ['#4a68c9', '#2fb2a4', '#8a63d2', '#e8a33d', '#e0575b', '#50a4e0', '#7d8aa3'];

export function AnalisisPage() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState<Analisis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Analisis>('/dashboard/valor-inventario').then((r) => {
      if (r.ok && r.data) {
        setDatos(r.data);
      } else {
        setError(r.mensaje ?? 'No se pudo cargar el análisis.');
      }
    });
  }, []);

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={18} />}>
        {error}
      </Alert>
    );
  }

  if (!datos) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const totalValor = Number(datos.totalValor) || 1;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Análisis del valor del inventario</Title>
          <Text c="dimmed" size="sm">
            Distribución del valor por categoría y productos que más aportan
          </Text>
        </div>
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/u/panel')}
        >
          Volver al panel
        </Button>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Kpi etiqueta="Valor total" valor={moneda(datos.totalValor)} icono={<IconCash size={20} />} color="teal" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Kpi etiqueta="Unidades" valor={datos.totalUnidades} icono={<IconStack2 size={20} />} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Kpi etiqueta="Productos" valor={datos.totalProductos} icono={<IconPackage size={20} />} color="violet" />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card>
            <Text fw={600} mb="md">
              Valor por categoría
            </Text>
            <Stack gap="md">
              {(datos.porCategoria ?? []).map((c, i) => {
                const pct = (Number(c.valor) / totalValor) * 100;
                return (
                  <div key={c.categoria}>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm">{c.categoria}</Text>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>
                          {moneda(c.valor)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {pct.toFixed(1)}%
                        </Text>
                      </Group>
                    </Group>
                    <Progress value={pct} color={COLORES[i % COLORES.length]} size="md" />
                    <Text size="xs" c="dimmed" mt={2}>
                      {c.productos} producto(s) · {c.unidades} unidad(es)
                    </Text>
                  </div>
                );
              })}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card padding={0}>
            <Text fw={600} p="md" pb="xs">
              Productos que más aportan al valor
            </Text>
            <Table.ScrollContainer minWidth={420}>
              <Table highlightOnHover className="qw-tabla-clicable">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Producto</Table.Th>
                    <Table.Th>Existencias</Table.Th>
                    <Table.Th>Valor</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(datos.topProductos ?? []).map((p) => (
                    <Table.Tr key={p.id} onClick={() => navigate(`/u/productos/${p.id}`)}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {p.nombre}
                        </Text>
                        {p.categoria && (
                          <Badge size="xs" variant="light" color="gray">
                            {p.categoria}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>{p.stock}</Table.Td>
                      <Table.Td>{moneda(p.valor)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
