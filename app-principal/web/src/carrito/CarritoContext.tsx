import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import {
  CarritoContext,
  MAX_POR_PRODUCTO,
  guardarCarrito,
  leerCarrito,
  type EstadoCarrito,
  type ItemCarrito,
} from './carritoEstado';

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>(leerCarrito);

  useEffect(() => {
    if (!guardarCarrito(items)) {
      notifications.show({
        id: 'carrito-sin-almacenamiento',
        color: 'yellow',
        message:
          'El carrito no pudo guardarse en este navegador y solo se conservará mientras la página permanezca abierta.',
      });
    }
  }, [items]);

  const valor = useMemo<EstadoCarrito>(() => {
    const limitar = (n: number) => Math.max(1, Math.min(MAX_POR_PRODUCTO, n));
    return {
      items,
      agregar: (item, cantidad = 1) =>
        setItems((prev) => {
          const existe = prev.find((i) => i.producto_id === item.producto_id);
          if (existe) {
            return prev.map((i) =>
              i.producto_id === item.producto_id
                ? { ...i, cantidad: limitar(i.cantidad + cantidad) }
                : i,
            );
          }
          return [...prev, { ...item, cantidad: limitar(cantidad) }];
        }),
      cambiarCantidad: (producto_id, cantidad) =>
        setItems((prev) =>
          prev.map((i) =>
            i.producto_id === producto_id
              ? { ...i, cantidad: limitar(cantidad) }
              : i,
          ),
        ),
      quitar: (producto_id) =>
        setItems((prev) => prev.filter((i) => i.producto_id !== producto_id)),
      limpiar: () => setItems([]),
      total: items.reduce((s, i) => s + Number(i.precio) * i.cantidad, 0),
      unidades: items.reduce((s, i) => s + i.cantidad, 0),
    };
  }, [items]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}
