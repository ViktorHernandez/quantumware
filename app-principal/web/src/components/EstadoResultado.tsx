import { Button, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export interface AccionEstado {
  etiqueta: string;
  onClick?: () => void;
  icono?: ReactNode;
  variante?: 'filled' | 'light' | 'default';
}

export function EstadoResultado({
  icono: Icono,
  color = 'marca',
  titulo,
  descripcion,
  acciones,
  compacto,
}: {
  icono: Icon;
  color?: string;
  titulo: string;
  descripcion?: string;
  acciones?: AccionEstado[];
  compacto?: boolean;
}) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="md"
      py={compacto ? 'xl' : 48}
      px="md"
      style={{ textAlign: 'center', minHeight: compacto ? undefined : '60vh' }}
    >
      <ThemeIcon size={compacto ? 56 : 76} radius="xl" variant="light" color={color}>
        <Icono size={compacto ? 30 : 40} />
      </ThemeIcon>
      <div>
        <Title order={compacto ? 4 : 2}>{titulo}</Title>
        {descripcion && (
          <Text c="dimmed" size="sm" mt={6} maw={460} mx="auto">
            {descripcion}
          </Text>
        )}
      </div>
      {acciones && acciones.length > 0 && (
        <Group justify="center" gap="sm">
          {acciones.map((a) => (
            <Button
              key={a.etiqueta}
              onClick={a.onClick}
              variant={a.variante ?? 'filled'}
              leftSection={a.icono}
            >
              {a.etiqueta}
            </Button>
          ))}
        </Group>
      )}
    </Stack>
  );
}
