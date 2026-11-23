import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
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
  IconPlayerStop,
  IconSearch,
} from '@tabler/icons-react';
import { useLab } from '../store/labEstado';
import type {
  DefinicionEscenario,
  PedidoDescubierto,
  ResultadoEscenario,
} from '../types';
import { ResultadoView } from './ResultadoView';

const ETIQUETA_TIPO: Record<string, string> = {
  funcional: 'Funcional',
  explotacion: 'Explotación',
  autorizacion: 'Autorización',
};

function Tarjeta({ def }: { def: DefinicionEscenario }) {
  const {
    ejecutarEscenario,
    descubrirPedidos,
    config,
    enEjecucion,
    detenerEjecucion,
  } = useLab();
  const [resultado, setResultado] = useState<ResultadoEscenario | null>(null);
  const [cargando, setCargando] = useState(false);
  const [tokenManual, setTokenManual] = useState('');
  const [pedidoObjetivo, setPedidoObjetivo] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoDescubierto[]>([]);
  const [descubriendo, setDescubriendo] = useState(false);
  const [avisoDescubrir, setAvisoDescubrir] = useState<string | null>(null);

  const pedidosAjenos = pedidos.filter((p) => !p.esDelAtacante);

  const descubrir = async () => {
    setDescubriendo(true);
    try {
      const r = await descubrirPedidos();
      setPedidos(r.pedidos);
      setAvisoDescubrir(r.mensaje);
      if (!r.ok) {
        notifications.show({ color: 'orange', message: r.mensaje });
      }
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'No se pudo descubrir.',
      });
    } finally {
      setDescubriendo(false);
    }
  };

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
          <Stack gap={6}>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconSearch size={16} />}
              onClick={descubrir}
              loading={descubriendo}
              w="fit-content"
            >
              Descubrir pedidos de otros clientes
            </Button>
            {avisoDescubrir && (
              <Text size="xs" c="dimmed">
                {avisoDescubrir}
              </Text>
            )}
            {pedidosAjenos.length > 0 && (
              <Select
                label="Pedido de otro cliente de laboratorio"
                description="Listado con la sesión de administrador. Elige uno que NO sea de tu sesión de cliente; su identificador se carga abajo."
                placeholder="Selecciona un pedido ajeno"
                searchable
                data={pedidosAjenos.map((p) => ({
                  value: p.id,
                  label: `${p.estado || 'pedido'} · ${p.propietarioEtiqueta} · ${p.id.slice(0, 8)}…`,
                }))}
                value={
                  pedidosAjenos.some((p) => p.id === pedidoObjetivo)
                    ? pedidoObjetivo
                    : null
                }
                onChange={(v) => {
                  if (v) {
                    setPedidoObjetivo(v);
                  }
                }}
              />
            )}
            <TextInput
              label="Identificador del pedido objetivo (de otro cliente)"
              description="UUID de un pedido de laboratorio de OTRO cliente. Puedes revisarlo o pegarlo manualmente. Sin este valor el escenario no se ejecuta."
              placeholder="00000000-0000-0000-0000-000000000000"
              value={pedidoObjetivo}
              onChange={(e) => setPedidoObjetivo(e.currentTarget.value)}
            />
          </Stack>
        )}

        {def.origenToken === 'expirado' && (
          <TextInput
            label="Token expirado (opcional)"
            description="Déjalo vacío para usar el token de laboratorio generado en «Sesiones». Solo pega aquí un token COMPLETO cuya marca exp ya venció; no pegues el texto enmascarado."
            placeholder="Vacío = usa el token generado en «Sesiones»"
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
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconPlayerStop size={16} />}
            onClick={detenerEjecucion}
            disabled={!enEjecucion}
          >
            Detener
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
