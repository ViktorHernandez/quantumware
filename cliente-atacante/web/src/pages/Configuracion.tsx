import { Badge, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useLab } from '../store/labEstado';

export function Configuracion() {
  const { config } = useLab();
  if (!config) return null;

  const filas: { parametro: string; valor: React.ReactNode }[] = [
    { parametro: 'Aplicación objetivo', valor: config.objetivo },
    { parametro: 'Puerto del cliente atacante', valor: '4000' },
    { parametro: 'Puerto de la aplicación principal', valor: '3000' },
    {
      parametro: 'Modo de vulnerabilidad del backend',
      valor: (
        <Badge color={config.vulnMode === 'vulnerable' ? 'red' : 'teal'}>
          {config.vulnMode}
        </Badge>
      ),
    },
    {
      parametro: 'Identidad (Supabase)',
      valor: config.supabaseConfigurado ? 'configurada' : 'sin configurar',
    },
    { parametro: 'Escenarios definidos', valor: config.escenarios.length },
  ];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Configuración del laboratorio</Title>
        <Text c="dimmed" size="sm">
          Parámetros del entorno de pruebas (solo lectura)
        </Text>
      </div>

      <Card withBorder padding={0}>
        <Table>
          <Table.Tbody>
            {filas.map((f) => (
              <Table.Tr key={f.parametro}>
                <Table.Td w="50%">
                  <Text size="sm" fw={500}>
                    {f.parametro}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {f.valor}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder>
        <Group gap="xs" mb={6}>
          <Text fw={600}>Restricción del laboratorio</Text>
          <Badge color="red" variant="light">
            obligatoria
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          El motor de solicitudes solo acepta destinos en localhost (la aplicación
          principal autorizada). Cualquier otro destino se rechaza. El modo de
          vulnerabilidad mostrado proviene del backend real, por lo que la etiqueta
          siempre corresponde al comportamiento activo.
        </Text>
      </Card>
    </Stack>
  );
}
