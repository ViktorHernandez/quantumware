import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown,
  IconChevronRight,
  IconInfoCircle,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { useLab } from '../store/labEstado';
import type { DefinicionEscenario, ResultadoEscenario } from '../types';
import { ResultadoView } from './ResultadoView';

const ETIQUETA_TIPO: Record<string, string> = {
  funcional: 'Funcional',
  explotacion: 'Explotación',
  autorizacion: 'Autorización',
};

function Tarjeta({ def }: { def: DefinicionEscenario }) {
  const { ejecutarEscenario, config } = useLab();
  const [resultado, setResultado] = useState<ResultadoEscenario | null>(null);
  const [cargando, setCargando] = useState(false);
  const [tokenManual, setTokenManual] = useState('');
  const [pedidoObjetivo, setPedidoObjetivo] = useState('');
  const [abierto, setAbierto] = useState(false);

  const ejecutar = async () => {
    setCargando(true);
    try {
      const opciones: {
        tokenManual?: string;
        pedidoObjetivo?: string;
      } = {};
      if (def.origenToken === 'expirado' && tokenManual) {
        opciones.tokenManual = tokenManual;
      }
      if (def.requierePedidoObjetivo && pedidoObjetivo) {
        opciones.pedidoObjetivo = pedidoObjetivo.trim();
      }
      const r = await ejecutarEscenario(
        def.id,
        Object.keys(opciones).length > 0 ? opciones : undefined,
      );
      setResultado(r);
      setAbierto(true);
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'No se pudo ejecutar.',
      });
    } finally {
      setCargando(false);
    }
  };

  const insigniaCumple =
    resultado === null ? null : resultado.cumple === null ? (
      <Badge color="gray" variant="light">
        pendiente de criterio
      </Badge>
    ) : resultado.cumple ? (
      <Badge color="teal">satisfactoria</Badge>
    ) : (
      <Badge color="red">fallida</Badge>
    );

  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Badge variant="filled">{def.id}</Badge>
            <Text fw={600}>{def.titulo}</Text>
          </Group>
          <Badge variant="light" color="gray">
            {ETIQUETA_TIPO[def.tipo]}
          </Badge>
        </Group>
        <Text size="sm" ff="monospace" c="dimmed">
          {def.metodo} {def.ruta}
        </Text>
        <Text size="sm">{def.descripcion}</Text>

        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={
            abierto ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />
          }
          onClick={() => setAbierto((a) => !a)}
          w="fit-content"
          px={4}
        >
          Detalle del caso
        </Button>
        {abierto && (
          <Stack gap={6} pl="xs" style={{ borderLeft: '2px solid #eee' }}>
            <Text size="xs">
              <b>Preparación:</b> {def.preparacion}
            </Text>
            <Text size="xs">
              <b>Resultado esperado:</b> {def.esperadoBase}
            </Text>
            {def.restablecimiento && (
              <Text size="xs">
                <b>Restablecimiento:</b> {def.restablecimiento}
              </Text>
            )}
          </Stack>
        )}

        {def.dependeDeModo && (
          <Alert color="yellow" icon={<IconInfoCircle size={16} />} p="xs">
            El resultado esperado depende del modo del backend. Modo actual:{' '}
            <b>{config?.vulnMode ?? 'desconocido'}</b>.
          </Alert>
        )}

        {def.requierePedidoObjetivo && (
          <TextInput
            label="Identificador del pedido objetivo (de otro cliente)"
            description="UUID de un pedido de laboratorio perteneciente a OTRO cliente. Sin este valor el escenario no se ejecuta."
            placeholder="00000000-0000-0000-0000-000000000000"
            value={pedidoObjetivo}
            onChange={(e) => setPedidoObjetivo(e.currentTarget.value)}
          />
        )}

        {def.origenToken === 'expirado' && (
          <TextInput
            label="Token expirado (opcional)"
            description="Si lo dejas vacío se usa el token de cliente capturado (debe estar vencido)."
            placeholder="Pega aquí un token cuya expiración ya venció"
            value={tokenManual}
            onChange={(e) => setTokenManual(e.currentTarget.value)}
          />
        )}

        <Group>
          <Button
            size="xs"
            leftSection={<IconPlayerPlay size={16} />}
            onClick={ejecutar}
            loading={cargando}
          >
            Ejecutar
          </Button>
          {insigniaCumple}
          {resultado && (
            <Badge variant="light" color="gray">
              modo: {resultado.modoBackend}
            </Badge>
          )}
        </Group>

        {resultado && (
          <Stack gap="xs">
            <ResultadoView resultado={resultado.resultado} />
            <Text size="xs">
              <b>Esperado:</b> {resultado.esperado}
            </Text>
            <Text size="xs">
              <b>Observación:</b> {resultado.observacion}
            </Text>
            {resultado.restablecimiento && (
              <Text size="xs" c="dimmed">
                Restablecimiento: {resultado.restablecimiento}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Evidencia: {resultado.evidencia}
            </Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function Escenarios({ tipo }: { tipo?: string }) {
  const { config } = useLab();
  if (!config) return null;

  const grupos = [
    { tipo: 'funcional', titulo: 'Prueba funcional' },
    { tipo: 'explotacion', titulo: 'Pruebas de explotación' },
    { tipo: 'autorizacion', titulo: 'Escenarios de autorización' },
  ].filter((g) => !tipo || g.tipo === tipo);

  return (
    <Stack gap="lg">
      {grupos.map((g) => (
        <Stack key={g.tipo} gap="sm">
          {!tipo && <Title order={4}>{g.titulo}</Title>}
          {g.tipo === 'explotacion' && !config.permitirExplotacion ? (
            <>
              <Alert color="teal" icon={<IconInfoCircle size={18} />}>
                Demostración pública segura: PE-01 y PE-02 envían casos de prueba
                controlados únicamente al objetivo QuantumWare autorizado. El
                servidor debe confirmar el modo corregido; la inyección se trata
                como texto y la cantidad fuera de límite se rechaza. El despliegue
                no activa el modo vulnerable ni modifica datos con estas pruebas.
              </Alert>
              {config.escenarios
                .filter((e) => e.id === 'PE-01' || e.id === 'PE-02')
                .map((e) => <Tarjeta key={e.id} def={e} />)}
            </>
          ) : (
            config.escenarios
              .filter((e) => e.tipo === g.tipo)
              .map((e) => <Tarjeta key={e.id} def={e} />)
          )}
        </Stack>
      ))}
    </Stack>
  );
}
