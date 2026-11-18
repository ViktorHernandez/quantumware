import { useState } from 'react';
import { Badge, Button, Card, Group, Stack, Table, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useLab } from '../store/labEstado';
import { ResultadoView } from './ResultadoView';
import { colorEstado } from '../utils/colorEstado';

const COLOR_ORIGEN: Record<string, string> = {
  escenario: 'grape',
  consola: 'blue',
  terminal: 'dark',
};

export function Historial() {
  const { historial, limpiarHistorial } = useLab();
  const [abierto, setAbierto] = useState<number | null>(null);

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Historial de solicitudes ({historial.length})</Text>
        <Button
          size="xs"
          variant="light"
          color="gray"
          leftSection={<IconTrash size={14} />}
          onClick={limpiarHistorial}
          disabled={historial.length === 0}
        >
          Limpiar
        </Button>
      </Group>
      {historial.length === 0 ? (
        <Text size="sm" c="dimmed">
          Todavía no se han ejecutado solicitudes en esta sesión.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Origen</Table.Th>
                <Table.Th>Solicitud</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Tiempo</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {historial.map((h) => (
                <>
                  <Table.Tr
                    key={h.id}
                    onClick={() => setAbierto(abierto === h.id ? null : h.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td>
                      <Badge size="xs" color={COLOR_ORIGEN[h.origen]} variant="light">
                        {h.origen}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" lineClamp={1}>
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
                  <Table.Tr key={`${h.id}-detalle`}>
                    <Table.Td colSpan={4} p={0} style={{ border: 'none' }}>
                      {abierto === h.id && (
                        <Stack px="md" pb="sm">
                          <ResultadoView resultado={h.resultado} />
                        </Stack>
                      )}
                    </Table.Td>
                  </Table.Tr>
                </>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}
