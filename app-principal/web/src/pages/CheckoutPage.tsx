import { useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Group,
  List,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconShieldCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useCarrito } from '../carrito/carritoEstado';
import { EstadoResultado } from '../components/EstadoResultado';
import { IconShoppingCart } from '@tabler/icons-react';
import { nombreComercial } from '../utils/textoCatalogo';
import { moneda } from '../utils/formato';

function crearClaveIdempotencia(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total, limpiar } = useCarrito();
  const [enviando, setEnviando] = useState(false);
  const [clave] = useState(crearClaveIdempotencia);

  if (items.length === 0) {
    return (
      <EstadoResultado
        icono={IconShoppingCart}
        titulo="No hay nada para pagar"
        descripcion="Tu carrito está vacío."
        acciones={[{ etiqueta: 'Ir al catálogo', onClick: () => navigate('/u/productos') }]}
      />
    );
  }

  const confirmar = async () => {
    setEnviando(true);
    const r = await apiFetch<{ id: string }>('/pedidos/checkout', {
      metodo: 'POST',
      cuerpo: {
        clave_idempotencia: clave,
        items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
      },
    });
    setEnviando(false);
    if (r.ok && r.data) {
      limpiar();
      navigate(`/u/pedidos/${r.data.id}/pagar`);
    } else {
      notifications.show({
        color: 'red',
        message: r.mensaje ?? 'No se pudo crear el pedido.',
      });
    }
  };

  return (
    <Stack gap="lg" maw={640}>
      <Title order={2}>Revisar pedido</Title>
      <Card>
        <List spacing="sm">
          {items.map((i) => (
            <List.Item key={i.producto_id}>
              <Group justify="space-between" w="100%">
                <Text>
                  {nombreComercial(i.nombre)}{' '}
                  <Text span c="dimmed" size="sm">
                    × {i.cantidad}
                  </Text>
                </Text>
                <Text fw={600}>{moneda(Number(i.precio) * i.cantidad)}</Text>
              </Group>
            </List.Item>
          ))}
        </List>
        <Divider my="md" />
        <Group justify="space-between">
          <Text fw={600}>Total</Text>
          <Text fw={700} fz="xl">
            {moneda(total)}
          </Text>
        </Group>
      </Card>
      <Group gap="xs" c="dimmed">
        <IconShieldCheck size={16} />
        <Text size="sm">
          El pago es una simulación con datos de prueba; no se realizan cobros reales.
        </Text>
      </Group>
      <Group justify="space-between">
        <Button
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/u/carrito')}
        >
          Volver al carrito
        </Button>
        <Button onClick={confirmar} loading={enviando}>
          Confirmar y pagar
        </Button>
      </Group>
    </Stack>
  );
}
