import {
  Button,
  Card,
  Group,
  Image,
  NumberInput,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconShoppingCart, IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useCarrito, MAX_POR_PRODUCTO } from '../carrito/carritoEstado';
import { EstadoResultado } from '../components/EstadoResultado';
import { nombreComercial } from '../utils/textoCatalogo';
import {
  imagenPlaceholder,
  rutaImagenProducto,
} from '../utils/imagenProducto';
import { moneda } from '../utils/formato';

export function CarritoPage() {
  const navigate = useNavigate();
  const { items, cambiarCantidad, quitar, total } = useCarrito();

  if (items.length === 0) {
    return (
      <EstadoResultado
        icono={IconShoppingCart}
        titulo="Tu carrito está vacío"
        descripcion="Agrega productos desde el catálogo para iniciar un pedido."
        acciones={[
          { etiqueta: 'Ir al catálogo', onClick: () => navigate('/u/productos') },
        ]}
      />
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Tu carrito</Title>
      <Card padding={0}>
        <Table.ScrollContainer minWidth={620}>
          <Table verticalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Producto</Table.Th>
                <Table.Th w={140}>Cantidad</Table.Th>
                <Table.Th>Precio</Table.Th>
                <Table.Th>Subtotal</Table.Th>
                <Table.Th w={48} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((i) => (
                <Table.Tr key={i.producto_id}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Image
                        src={rutaImagenProducto(i.nombre, i.imagen_url)}
                        fallbackSrc={imagenPlaceholder(i.nombre, i.categoria)}
                        w={56}
                        h={56}
                        fit="contain"
                        radius="sm"
                        bg="gray.0"
                        alt={`Fotografía de ${i.nombre}`}
                      />
                      <div>
                        <Text fw={500}>{nombreComercial(i.nombre)}</Text>
                        {i.categoria && (
                          <Text size="xs" c="dimmed">
                            {i.categoria}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      value={i.cantidad}
                      onChange={(v) => cambiarCantidad(i.producto_id, Number(v) || 1)}
                      min={1}
                      max={MAX_POR_PRODUCTO}
                      clampBehavior="strict"
                      size="xs"
                    />
                  </Table.Td>
                  <Table.Td>{moneda(i.precio)}</Table.Td>
                  <Table.Td fw={600}>
                    {moneda(Number(i.precio) * i.cantidad)}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      px={6}
                      onClick={() => quitar(i.producto_id)}
                    >
                      <IconTrash size={16} />
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Máximo {MAX_POR_PRODUCTO} unidades por producto
        </Text>
        <Group gap="lg">
          <Text fz="lg">
            Total:{' '}
            <Text span fw={700} fz="xl">
              {moneda(total)}
            </Text>
          </Text>
          <Button size="md" onClick={() => navigate('/u/checkout')}>
            Continuar al pago
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
