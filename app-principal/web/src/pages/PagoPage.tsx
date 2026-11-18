import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuildingBank,
  IconCash,
  IconCircleCheck,
  IconCircleX,
  IconCreditCard,
  IconLockSquareRounded,
  IconShieldCheck,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { moneda } from '../utils/formato';
import { ETIQUETA_PAGO } from '../utils/pedidoEstados';

interface Pedido {
  id: string;
  total: string;
  estado: string;
  estado_pago: string;
  numero_seguimiento: string | null;
}

const METODOS = [
  { label: 'Crédito', value: 'tarjeta_credito' },
  { label: 'Débito', value: 'tarjeta_debito' },
  { label: 'Transferencia', value: 'transferencia' },
  { label: 'Efectivo', value: 'efectivo_simulado' },
];

const NOMBRE_METODO: Record<string, string> = {
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta de débito',
  transferencia: 'Transferencia',
  efectivo_simulado: 'Efectivo simulado',
};

function formatearNumero(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 16);
  return digitos.replace(/(.{4})/g, '$1 ').trim();
}

function formatearVencimiento(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) {
    return digitos;
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
}

function vencimientoVigente(valor: string): boolean {
  if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(valor)) {
    return false;
  }
  const [mes, anio] = valor.split('/').map(Number);
  const ahora = new Date();
  const anioCompleto = 2000 + anio;
  if (anioCompleto > ahora.getFullYear()) {
    return true;
  }
  return (
    anioCompleto === ahora.getFullYear() && mes >= ahora.getMonth() + 1
  );
}

export function PagoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [metodo, setMetodo] = useState('tarjeta_credito');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [titular, setTitular] = useState('');
  const [numero, setNumero] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cvv, setCvv] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<Pedido | null>(null);

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      const r = await apiFetch<Pedido>(`/pedidos/${id}`);
      if (!vigente) {
        return;
      }
      setCargando(false);
      if (r.ok && r.data) {
        setPedido(r.data);
        if (r.data.estado_pago === 'aprobado') {
          navigate(`/u/pedidos/${id}`, { replace: true });
        }
      }
    };
    void cargar();
    return () => {
      vigente = false;
    };
  }, [id, navigate]);

  const conTarjeta = metodo === 'tarjeta_credito' || metodo === 'tarjeta_debito';

  const abrirModal = () => {
    setErrores({});
    setResultado(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (!procesando) {
      setModalAbierto(false);
    }
  };

  const validar = (): boolean => {
    if (!conTarjeta) {
      return true;
    }
    const e: Record<string, string> = {};
    if (titular.trim().length < 3) {
      e.titular = 'Escribe el nombre como aparece en la tarjeta.';
    }
    const digitos = numero.replace(/\D/g, '');
    if (digitos.length !== 16) {
      e.numero = 'El número de tarjeta de prueba debe tener 16 dígitos.';
    }
    if (!vencimientoVigente(vencimiento)) {
      e.vencimiento = 'Usa el formato MM/AA con una fecha vigente.';
    }
    if (!/^[0-9]{3,4}$/.test(cvv)) {
      e.cvv = 'El código de seguridad tiene 3 o 4 dígitos.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const pagar = async () => {
    if (!validar()) {
      return;
    }
    setProcesando(true);
    const cuerpo: Record<string, string> = { metodo };
    if (conTarjeta) {
      cuerpo.tarjeta_ultimos4 = numero.replace(/\D/g, '').slice(-4);
    }
    const r = await apiFetch<Pedido>(`/pedidos/${id}/pagar`, {
      metodo: 'POST',
      cuerpo,
    });
    setProcesando(false);
    if (r.ok && r.data) {
      setResultado(r.data);
      setPedido(r.data);
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo procesar el pago.',
      });
    }
  };

  if (cargando) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  if (!pedido) {
    return <Alert color="red">No se encontró el pedido.</Alert>;
  }

  const ultimos4 = numero.replace(/\D/g, '').slice(-4);

  return (
    <Stack gap="lg" maw={560}>
      <div>
        <Title order={2}>Pago del pedido</Title>
        <Text c="dimmed" size="sm">
          Elige un método y confirma el pago en la ventana segura
        </Text>
      </div>

      <Card>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text c="dimmed">Total a pagar</Text>
            <Text fw={700} fz="xl">
              {moneda(pedido.total)}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              Estado del pago
            </Text>
            <Badge
              variant="light"
              color={pedido.estado_pago === 'rechazado' ? 'red' : 'yellow'}
            >
              {ETIQUETA_PAGO[pedido.estado_pago] ?? pedido.estado_pago}
            </Badge>
          </Group>
        </Stack>
      </Card>

      {pedido.estado_pago === 'rechazado' && !modalAbierto && (
        <Alert color="red" icon={<IconCircleX size={18} />}>
          El último intento de pago fue rechazado. Puedes intentarlo de nuevo
          con otra tarjeta de prueba u otro método.
        </Alert>
      )}

      <Card>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600} mb={6}>
              Método de pago
            </Text>
            <SegmentedControl
              fullWidth
              value={metodo}
              onChange={setMetodo}
              data={METODOS}
            />
          </div>
          <Button
            size="md"
            leftSection={<IconLockSquareRounded size={18} />}
            onClick={abrirModal}
          >
            Continuar al pago de {moneda(pedido.total)}
          </Button>
          <Group gap={8} justify="center">
            <IconShieldCheck size={15} color="var(--mantine-color-gray-6)" />
            <Text size="xs" c="dimmed">
              Pago simulado con datos de prueba; no se realizan cargos reales.
            </Text>
          </Group>
        </Stack>
      </Card>

      <Modal
        opened={modalAbierto}
        onClose={cerrarModal}
        title={
          <Group gap={8}>
            <IconLockSquareRounded size={18} />
            <Text fw={700}>Pago simulado seguro</Text>
          </Group>
        }
        centered
        closeOnClickOutside={!procesando}
        withCloseButton={!procesando}
      >
        {resultado ? (
          <Stack align="center" gap="md" py="sm">
            {resultado.estado_pago === 'aprobado' ? (
              <>
                <ThemeIcon size={64} radius="xl" color="acento" variant="light">
                  <IconCircleCheck size={36} />
                </ThemeIcon>
                <Title order={3}>Pago aprobado</Title>
                <Text c="dimmed" size="sm" ta="center">
                  {NOMBRE_METODO[metodo]}
                  {conTarjeta && ultimos4 ? ` terminada en ${ultimos4}` : ''} por{' '}
                  {moneda(resultado.total)}
                </Text>
                {resultado.numero_seguimiento && (
                  <Group gap={8}>
                    <IconTruckDelivery size={18} color="var(--mantine-color-gray-6)" />
                    <Text size="sm">Seguimiento:</Text>
                    <Badge variant="light" color="marca" size="lg">
                      {resultado.numero_seguimiento}
                    </Badge>
                  </Group>
                )}
                <Button
                  fullWidth
                  onClick={() => navigate(`/u/pedidos/${pedido.id}`)}
                >
                  Ver mi pedido
                </Button>
              </>
            ) : (
              <>
                <ThemeIcon size={64} radius="xl" color="red" variant="light">
                  <IconCircleX size={36} />
                </ThemeIcon>
                <Title order={3}>Pago rechazado</Title>
                <Text c="dimmed" size="sm" ta="center">
                  La simulación rechazó esta tarjeta de prueba. Revisa los datos
                  o intenta con otro método.
                </Text>
                <Button
                  fullWidth
                  variant="light"
                  color="red"
                  onClick={() => setResultado(null)}
                >
                  Intentar de nuevo
                </Button>
              </>
            )}
          </Stack>
        ) : (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap={8}>
                {conTarjeta ? (
                  <IconCreditCard size={18} />
                ) : metodo === 'transferencia' ? (
                  <IconBuildingBank size={18} />
                ) : (
                  <IconCash size={18} />
                )}
                <Text size="sm" fw={600}>
                  {NOMBRE_METODO[metodo]}
                </Text>
              </Group>
              <Text fw={700}>{moneda(pedido.total)}</Text>
            </Group>
            <Divider />
            {conTarjeta ? (
              <>
                <TextInput
                  label="Nombre del titular"
                  placeholder="Como aparece en la tarjeta"
                  autoComplete="off"
                  value={titular}
                  error={errores.titular}
                  onChange={(e) => setTitular(e.currentTarget.value)}
                />
                <TextInput
                  label="Número de tarjeta"
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric"
                  autoComplete="off"
                  leftSection={<IconCreditCard size={16} />}
                  value={numero}
                  error={errores.numero}
                  onChange={(e) => setNumero(formatearNumero(e.currentTarget.value))}
                />
                <Group grow>
                  <TextInput
                    label="Vencimiento"
                    placeholder="MM/AA"
                    inputMode="numeric"
                    autoComplete="off"
                    value={vencimiento}
                    error={errores.vencimiento}
                    onChange={(e) =>
                      setVencimiento(formatearVencimiento(e.currentTarget.value))
                    }
                  />
                  <TextInput
                    label="CVV"
                    placeholder="123"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={cvv}
                    error={errores.cvv}
                    onChange={(e) =>
                      setCvv(e.currentTarget.value.replace(/\D/g, ''))
                    }
                  />
                </Group>
                <Text size="xs" c="dimmed">
                  Tarjetas de prueba: cualquier número de 16 dígitos se aprueba;
                  una terminada en 0002 se rechaza. Solo los últimos cuatro
                  dígitos se envían al servidor.
                </Text>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                Confirmarás un pago simulado por {moneda(pedido.total)} mediante{' '}
                {NOMBRE_METODO[metodo].toLowerCase()}. No se solicitan datos
                adicionales.
              </Text>
            )}
            <Button
              size="md"
              leftSection={<IconShieldCheck size={18} />}
              onClick={pagar}
              loading={procesando}
              fullWidth
            >
              Pagar {moneda(pedido.total)}
            </Button>
            <Box ta="center">
              <Text size="xs" c="dimmed">
                Entorno de pago de prueba del proyecto académico.
              </Text>
            </Box>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
