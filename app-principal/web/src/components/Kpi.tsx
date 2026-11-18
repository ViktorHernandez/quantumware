import { Card, Group, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

export function Kpi({
  etiqueta,
  valor,
  icono,
  color = 'marca',
  detalle,
  onClick,
}: {
  etiqueta: string;
  valor: ReactNode;
  icono: ReactNode;
  color?: string;
  detalle?: string;
  onClick?: () => void;
}) {
  const clicable = Boolean(onClick);
  return (
    <Card
      padding="md"
      onClick={onClick}
      role={clicable ? 'button' : undefined}
      tabIndex={clicable ? 0 : undefined}
      onKeyDown={
        clicable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={clicable ? { cursor: 'pointer' } : undefined}
      className={clicable ? 'qw-kpi-clicable' : undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lh={1.4}>
            {etiqueta}
          </Text>
          <Text fz={26} fw={700} lh={1.3} style={{ wordBreak: 'break-word' }}>
            {valor}
          </Text>
          {detalle && (
            <Text size="xs" c="dimmed">
              {detalle}
            </Text>
          )}
        </div>
        <ThemeIcon variant="light" color={color} size={40} radius="md">
          {icono}
        </ThemeIcon>
      </Group>
    </Card>
  );
}
