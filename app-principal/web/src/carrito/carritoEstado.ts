import { createContext, useContext } from 'react';

export const MAX_POR_PRODUCTO = 10;
const CLAVE = 'quantumware-carrito';

export interface ItemCarrito {
  producto_id: string;
  nombre: string;
  precio: string;
  categoria: string | null;
  imagen_url?: string | null;
  cantidad: number;
}

export interface EstadoCarrito {
  items: ItemCarrito[];
  agregar: (item: Omit<ItemCarrito, 'cantidad'>, cantidad?: number) => void;
  cambiarCantidad: (producto_id: string, cantidad: number) => void;
  quitar: (producto_id: string) => void;
  limpiar: () => void;
  total: number;
  unidades: number;
}

export const CarritoContext = createContext<EstadoCarrito | null>(null);

export function leerCarrito(): ItemCarrito[] {
  try {
    const bruto = localStorage.getItem(CLAVE);
    return bruto ? (JSON.parse(bruto) as ItemCarrito[]) : [];
  } catch {
    return [];
  }
}

export function guardarCarrito(items: ItemCarrito[]): boolean {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function useCarrito(): EstadoCarrito {
  const ctx = useContext(CarritoContext);
  if (!ctx) {
    throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  }
  return ctx;
}
