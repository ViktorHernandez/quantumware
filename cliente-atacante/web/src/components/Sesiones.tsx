import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLogin, IconLogout, IconRefresh } from '@tabler/icons-react';
import { useLab } from '../store/labEstado';

function cuentaRegresiva(expiraEn: string | null): string {
  if (!expiraEn) return 'sin expiración conocida';
  const restante = new Date(expiraEn).getTime() - Date.now();
  if (restante <= 0) return 'expirado';
  const min = Math.floor(restante / 60000);
  const seg = Math.floor((restante % 60000) / 1000);
  return `expira en ${min}m ${seg}s`;
}

export function Sesiones() {
  const { config, iniciarSesion, cerrarSesion, refrescar } = useLab();
  const [cargando, setCargando] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!config) return null;

  const accion = async (rol: 'admin' | 'cliente', entrar: boolean) => {
    setCargando(rol + (entrar ? 'in' : 'out'));
    try {
      if (entrar) {
        await iniciarSesion(rol);
        notifications.show({ color: 'teal', message: `Sesión ${rol} capturada.` });
      } else {
        await cerrarSesion(rol);
      }
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Operación no disponible.',
      });
    } finally {
      setCargando(null);
    }
  };

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Sesiones de prueba</Text>
        <Tooltip label="Actualizar estado">
          <ActionIcon variant="light" onClick={() => refrescar()}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {!config.supabaseConfigurado && (
        <Text size="sm" c="red" mb="sm">
          Supabase no está configurado en cliente-atacante/.env. Define
          SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y las credenciales de prueba.
        </Text>
      )}
      <Stack gap="sm">
        {(['admin', 'cliente'] as const).map((rol) => {
          const s = config.sesiones[rol];
          return (
            <Group key={rol} justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Badge color={rol === 'admin' ? 'grape' : 'blue'} w={72}>
                  {rol}
                </Badge>
                {s ? (
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" lineClamp={1}>
                      {s.email}
                    </Text>
                    <Text size="xs" c={s.expirado ? 'red' : 'dimmed'} ff="monospace">
                      {s.tokenEnmascarado} · {cuentaRegresiva(s.expiraEn)}
                    </Text>
                  </div>
                ) : (
                  <Text size="sm" c="dimmed">
                    sin sesión capturada
                  </Text>
                )}
              </Group>
              {s ? (
                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  leftSection={<IconLogout size={14} />}
                  loading={cargando === rol + 'out'}
                  onClick={() => accion(rol, false)}
                >
                  Cerrar
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconLogin size={14} />}
                  loading={cargando === rol + 'in'}
                  onClick={() => accion(rol, true)}
                  disabled={!config.supabaseConfigurado}
                >
                  Iniciar
                </Button>
              )}
            </Group>
          );
        })}
      </Stack>
    </Card>
  );
}
