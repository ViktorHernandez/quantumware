import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <ThemeIcon variant="light" size={48} radius="xl" color="gray">
          <IconInbox size={24} />
        </ThemeIcon>
        <Text fw={600}>{titulo}</Text>
        {descripcion && (
          <Text size="sm" c="dimmed" ta="center" maw={420}>
            {descripcion}
          </Text>
        )}
        {accion}
      </Stack>
    </Center>
  );
}
