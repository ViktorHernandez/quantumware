import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Group, List, Text } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { apiGet } from '../api';

export function Evidencias() {
  const [archivos, setArchivos] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    try {
      const r = await apiGet<{ evidencias: string[] }>('/api/evidencias');
      setArchivos(r.evidencias);
    } catch {
      setArchivos([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Evidencias registradas ({archivos.length})</Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={cargar}
        >
          Actualizar
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        Archivos JSON guardados por el backend del cliente atacante (carpeta
        indicada en EVIDENCE_DIR). Registran escenario, modo, solicitud,
        respuesta y criterio, con los tokens enmascarados.
      </Text>
      {archivos.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aún no hay evidencias. Ejecuta un escenario para generarlas.
        </Text>
      ) : (
        <List size="sm" withPadding>
          {archivos.map((a) => (
            <List.Item key={a}>
              <Text ff="monospace" size="xs">
                {a}
              </Text>
            </List.Item>
          ))}
        </List>
      )}
    </Card>
  );
}
