import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { useLab } from '../store/labEstado';
import type { ResultadoSolicitud } from '../types';
import { ResultadoView } from './ResultadoView';

interface Cabecera {
  clave: string;
  valor: string;
}

const ORIGENES = ['ninguno', 'admin', 'cliente', 'alterado', 'expirado', 'personalizado'];

export function Consola() {
  const { ejecutarSolicitud } = useLab();
  const [metodo, setMetodo] = useState('GET');
  const [ruta, setRuta] = useState('/productos');
  const [origenToken, setOrigenToken] = useState('cliente');
  const [tokenManual, setTokenManual] = useState('');
  const [cuerpoTexto, setCuerpoTexto] = useState('');
  const [cabeceras, setCabeceras] = useState<Cabecera[]>([]);
  const [resultado, setResultado] = useState<ResultadoSolicitud | null>(null);
  const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    let cuerpo: Record<string, unknown> | undefined;
    if (cuerpoTexto.trim()) {
      try {
        cuerpo = JSON.parse(cuerpoTexto);
      } catch {
        notifications.show({ color: 'red', message: 'El cuerpo no es JSON válido.' });
        return;
      }
    }
    const mapaCabeceras: Record<string, string> = {};
    for (const c of cabeceras) {
      if (c.clave.trim()) {
        mapaCabeceras[c.clave.trim()] = c.valor;
      }
    }
    setCargando(true);
    try {
      const r = await ejecutarSolicitud(
        {
          metodo,
          ruta,
          origenToken,
          tokenManual: tokenManual || undefined,
          cuerpo,
          cabeceras: Object.keys(mapaCabeceras).length ? mapaCabeceras : undefined,
        },
        'consola',
      );
      setResultado(r);
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'No se pudo enviar la solicitud.',
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Text fw={600}>Consola de solicitudes</Text>
        <Text size="xs" c="dimmed">
          Las solicitudes se dirigen exclusivamente a la aplicación principal
          local. La ruta debe comenzar con «/».
        </Text>
        <Group grow>
          <Select
            label="Método"
            data={['GET', 'POST', 'PUT', 'DELETE', 'PATCH']}
            value={metodo}
            onChange={(v) => setMetodo(v ?? 'GET')}
          />
          <Select
            label="Origen del token"
            data={ORIGENES}
            value={origenToken}
            onChange={(v) => setOrigenToken(v ?? 'ninguno')}
          />
        </Group>
        <TextInput
          label="Ruta"
          value={ruta}
          onChange={(e) => setRuta(e.currentTarget.value)}
        />
        {(origenToken === 'personalizado' || origenToken === 'expirado') && (
          <TextInput
            label="Token manual"
            value={tokenManual}
            onChange={(e) => setTokenManual(e.currentTarget.value)}
          />
        )}

        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>
              Cabeceras adicionales
            </Text>
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => setCabeceras([...cabeceras, { clave: '', valor: '' }])}
            >
              Añadir
            </Button>
          </Group>
          <Stack gap={6}>
            {cabeceras.map((c, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                <TextInput
                  placeholder="Nombre"
                  value={c.clave}
                  onChange={(e) => {
                    const copia = [...cabeceras];
                    copia[i] = { ...c, clave: e.currentTarget.value };
                    setCabeceras(copia);
                  }}
                  style={{ flex: 1 }}
                />
                <TextInput
                  placeholder="Valor"
                  value={c.valor}
                  onChange={(e) => {
                    const copia = [...cabeceras];
                    copia[i] = { ...c, valor: e.currentTarget.value };
                    setCabeceras(copia);
                  }}
                  style={{ flex: 1 }}
                />
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => setCabeceras(cabeceras.filter((_, j) => j !== i))}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </div>

        {metodo !== 'GET' && (
          <Textarea
            label="Cuerpo (JSON)"
            autosize
            minRows={3}
            value={cuerpoTexto}
            onChange={(e) => setCuerpoTexto(e.currentTarget.value)}
          />
        )}
        <Group>
          <Button leftSection={<IconSend size={16} />} onClick={enviar} loading={cargando}>
            Enviar
          </Button>
        </Group>
        {resultado && <ResultadoView resultado={resultado} />}
      </Stack>
    </Card>
  );
}
