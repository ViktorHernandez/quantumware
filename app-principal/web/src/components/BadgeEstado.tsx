import { Badge } from '@mantine/core';

const COLORES: Record<string, string> = {
  registrado: 'gray',
  confirmado: 'blue',
  enviado: 'violet',
  entregado: 'teal',
  cancelado: 'red',
};

export function BadgeEstado({ estado }: { estado: string }) {
  return (
    <Badge
      variant="light"
      color={COLORES[estado] ?? 'gray'}
      tt="uppercase"
      fw={600}
      size="sm"
    >
      {estado}
    </Badge>
  );
}
