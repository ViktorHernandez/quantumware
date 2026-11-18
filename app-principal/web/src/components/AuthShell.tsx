import {
  Box,
  Group,
  List,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineTheme,
} from '@mantine/core';
import type { ReactNode } from 'react';
import {
  IconBell,
  IconPackages,
  IconShieldLock,
} from '@tabler/icons-react';
import { Marca } from './Marca';

const CARACTERISTICAS = [
  {
    icono: IconPackages,
    titulo: 'Inventario y pedidos',
    texto: 'Catálogo, existencias, movimientos y pedidos en un solo lugar.',
  },
  {
    icono: IconShieldLock,
    titulo: 'Acceso seguro por roles',
    texto: 'Autenticación con verificación de tokens y permisos en el servidor.',
  },
  {
    icono: IconBell,
    titulo: 'Alertas en tiempo real',
    texto: 'Notificaciones de stock, pedidos y actividad sin recargar.',
  },
];

export function AuthShell({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const theme = useMantineTheme();
  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
      }}
    >
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          minHeight: '100vh',
        }}
      >
        <Box
          className="qw-auth-grid"
          style={{ display: 'grid', minHeight: '100vh', width: '100%' }}
        >
          <Box
            visibleFrom="md"
            p={48}
            style={{
              background: theme.other.gradienteMarca,
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Group gap="sm">
              <Marca size={38} variant="light" />
              <div style={{ lineHeight: 1.1 }}>
                <Text fw={800} fz="xl" c="#fff">
                  QuantumWare
                </Text>
                <Text fz={11} tt="uppercase" fw={700} style={{ opacity: 0.8 }}>
                  Gestión de inventario y pedidos
                </Text>
              </div>
            </Group>

            <Stack gap="xl" maw={460}>
              <Title order={1} c="#fff" style={{ fontSize: '2.3rem', lineHeight: 1.15 }}>
                El centro de operaciones de tu inventario
              </Title>
              <List spacing="lg" listStyleType="none" center>
                {CARACTERISTICAS.map((c) => (
                  <List.Item
                    key={c.titulo}
                    icon={
                      <ThemeIcon
                        size={40}
                        radius="md"
                        variant="white"
                        color="marca"
                      >
                        <c.icono size={22} />
                      </ThemeIcon>
                    }
                  >
                    <Text fw={600} c="#fff">
                      {c.titulo}
                    </Text>
                    <Text fz="sm" style={{ opacity: 0.85 }}>
                      {c.texto}
                    </Text>
                  </List.Item>
                ))}
              </List>
            </Stack>

            <Text fz="xs" style={{ opacity: 0.7 }}>
              Proyecto académico de Ciberseguridad · Uso local controlado
            </Text>
          </Box>

          <Box
            p="md"
            style={{
              background: theme.other.superficie,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Stack w="100%" maw={420} gap="lg">
              <Group gap="sm" hiddenFrom="md" justify="center">
                <Marca size={32} />
                <Text fw={800} fz="lg">
                  QuantumWare
                </Text>
              </Group>

              <Box
                p={{ base: 'lg', sm: 'xl' }}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: theme.shadows.lg,
                  border: '1px solid #eceef3',
                }}
              >
                <Stack gap="md">
                  <div>
                    <Title order={2}>{titulo}</Title>
                    {descripcion && (
                      <Text size="sm" c="dimmed" mt={6}>
                        {descripcion}
                      </Text>
                    )}
                  </div>
                  {children}
                </Stack>
              </Box>
              {pie}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
