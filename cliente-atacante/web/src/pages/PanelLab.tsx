import {
  Alert,
  Badge,
  Card,
  Grid,
  Group,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconActivity,
  IconAlertTriangle,
  IconCircleCheck,
  IconServer,
  IconShieldBolt,
  IconUsers,
} from '@tabler/icons-react';
import { useLab } from '../store/labEstado';
import { colorEstado } from '../utils/colorEstado';

function Indicador({
  etiqueta,
  valor,
  icono,
  color = 'gray',
}: {
  etiqueta: string;
  valor: React.ReactNode;
  icono: React.ReactNode;
  color?: string;
}) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {etiqueta}
          </Text>
          <Text fz={22} fw={700}>
            {valor}
          </Text>
        </div>
        <ThemeIcon variant="light" color={color} size={38} radius="md">
          {icono}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export function PanelLab() {
  const { config, historial } = useLab();
  if (!config) return null;

  const sesiones = Object.keys(config.sesiones).length;
  const ejecutadas = historial.length;
  const exitosas = historial.filter((h) => h.status >= 200 && h.status < 300).length;
  const recientes = historial.slice(0, 6);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Panel del laboratorio</Title>
        <Text c="dimmed" size="sm">
          Estado del entorno de pruebas y actividad reciente
        </Text>
      </div>

      <Alert color="red" icon={<IconAlertTriangle size={18} />}>
        Herramienta de uso académico. En el despliegue público, las pruebas
        disponibles se limitan a solicitudes controladas contra la aplicación
        QuantumWare autorizada y en modo corregido. No se habilita el modo
        vulnerable ni se permiten pruebas contra sistemas de terceros.
      </Alert>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Indicador
            etiqueta="Backend objetivo"
            valor={config.objetivo.replace('http://', '')}
            icono={<IconServer size={20} />}
            color="blue"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Indicador
            etiqueta="Modo de vulnerabilidad"
            valor={<Badge size="lg" color={config.vulnMode === 'vulnerable' ? 'red' : 'teal'}>{config.vulnMode}</Badge>}
            icono={<IconShieldBolt size={20} />}
            color={config.vulnMode === 'vulnerable' ? 'red' : 'teal'}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Indicador
            etiqueta="Sesiones capturadas"
            valor={sesiones}
            icono={<IconUsers size={20} />}
            color="grape"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Indicador
            etiqueta="Ejecuciones"
            valor={`${exitosas}/${ejecutadas}`}
            icono={<IconActivity size={20} />}
            color="teal"
          />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder padding={0}>
            <Text fw={600} p="md" pb="xs">
              Últimas ejecuciones
            </Text>
            {recientes.length === 0 ? (
              <Text size="sm" c="dimmed" p="md" pt={0}>
                Todavía no se han ejecutado pruebas en esta sesión.
              </Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Solicitud</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Tiempo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recientes.map((h) => (
                    <Table.Tr key={h.id}>
                      <Table.Td>
                        <Text size="sm" ff="monospace">
                          {h.metodo} {h.ruta}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {h.etiqueta}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={colorEstado(h.status)} variant="light">
                          {h.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{h.tiempoMs} ms</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder>
            <Text fw={600} mb="sm">
              Escenarios disponibles
            </Text>
            <Stack gap="xs">
              {[
                { t: 'funcional', l: 'Funcionales' },
                { t: 'explotacion', l: 'De explotación' },
                { t: 'autorizacion', l: 'De autorización' },
              ].map((g) => (
                <Group key={g.t} justify="space-between">
                  <Text size="sm">{g.l}</Text>
                  <Badge variant="light" color="gray">
                    {config.escenarios.filter((e) => e.tipo === g.t).length}
                  </Badge>
                </Group>
              ))}
              <Group justify="space-between" mt="xs">
                <Text size="sm">Identidad (Supabase)</Text>
                {config.supabaseConfigurado ? (
                  <Badge color="teal" variant="light" leftSection={<IconCircleCheck size={12} />}>
                    configurada
                  </Badge>
                ) : (
                  <Badge color="orange" variant="light">
                    sin configurar
                  </Badge>
                )}
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
