import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconClockPause,
  IconLogin,
  IconLogout,
  IconRefresh,
} from '@tabler/icons-react';
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
  const {
    config,
    iniciarSesion,
    cerrarSesion,
    refrescar,
    generarTokenExpirado,
  } = useLab();
  const [cargando, setCargando] = useState<string | null>(null);
  const [codigoMfa, setCodigoMfa] = useState('');
  const [tokenExpiradoCompleto, setTokenExpiradoCompleto] = useState<
    string | null
  >(null);
  const [avisoMfa, setAvisoMfa] = useState<string | null>(null);
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
        const r = await iniciarSesion(rol, codigoMfa || undefined);
        setCodigoMfa('');
        if (r.mfaPendiente) {
          setAvisoMfa(
            `La cuenta de ${rol} tiene verificación en dos pasos activa, así que el token capturado es de nivel aal1. PA-01 requiere aal2: escribe el código de 6 dígitos de tu aplicación de autenticación y vuelve a pulsar «Iniciar».`,
          );
          notifications.show({
            color: 'yellow',
            message: `Sesión ${rol} capturada con nivel aal1 (MFA pendiente).`,
          });
        } else {
          setAvisoMfa(null);
          notifications.show({
            color: 'teal',
            message: `Sesión ${rol} capturada${r.aal ? ` (${r.aal})` : ''}.`,
          });
        }
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
                    <Text
                      size="xs"
                      c={s.expirado ? 'red' : 'dimmed'}
                      ff="monospace"
                    >
                      {s.tokenEnmascarado} · {cuentaRegresiva(s.expiraEn)}
                      {s.aal ? ` · ${s.aal}` : ''}
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

      {avisoMfa && (
        <Alert color="yellow" mt="sm">
          {avisoMfa}
        </Alert>
      )}

      <TextInput
        mt="sm"
        label="Código de verificación en dos pasos (opcional)"
        description="Solo si la cuenta tiene MFA activa. Se usa una vez y no se almacena."
        placeholder="000000"
        maxLength={6}
        value={codigoMfa}
        onChange={(e) => setCodigoMfa(e.currentTarget.value.replace(/\D/g, ''))}
      />

      <Card withBorder mt="sm" padding="sm" bg="dark.8">
        <Group justify="space-between" wrap="nowrap">
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={600}>
              Token expirado para PA-04 (laboratorio)
            </Text>
            {config.sesiones.expirado ? (
              <Text
                size="xs"
                ff="monospace"
                c={config.sesiones.expirado.expirado ? 'teal' : 'dimmed'}
              >
                {config.sesiones.expirado.tokenEnmascarado} ·{' '}
                {config.sesiones.expirado.expirado
                  ? 'ya expiró: PA-04 se puede ejecutar'
                  : cuentaRegresiva(config.sesiones.expirado.expiraEn)}
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                Genera un token de laboratorio ya vencido, firmado con una clave
                que el servidor acepta. PA-04 lo rechazará por expiración. No usa
                tokens válidos ni falsificados.
              </Text>
            )}
            {tokenExpiradoCompleto && (
              <Stack gap={4} mt={6}>
                <Text size="xs" c="teal">
                  Ya quedó cargado: ejecuta PA-04 dejando el campo de token
                  vacío. El texto enmascarado de arriba no sirve para copiar; usa
                  el token completo de abajo.
                </Text>
                <Code
                  block
                  style={{
                    fontSize: 10,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {tokenExpiradoCompleto}
                </Code>
                <CopyButton value={tokenExpiradoCompleto}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="default"
                      w="fit-content"
                      onClick={copy}
                    >
                      {copied ? 'Token copiado' : 'Copiar token completo'}
                    </Button>
                  )}
                </CopyButton>
              </Stack>
            )}
          </div>
          <Button
            size="xs"
            variant="light"
            color="orange"
            leftSection={<IconClockPause size={14} />}
            loading={cargando === 'apartar'}
            disabled={!config.supabaseConfigurado}
            onClick={async () => {
              setCargando('apartar');
              try {
                const r = await generarTokenExpirado();
                setTokenExpiradoCompleto(r.ok ? r.token : null);
                notifications.show({
                  color: r.ok ? 'teal' : 'orange',
                  message: r.mensaje,
                });
              } catch (e) {
                notifications.show({
                  color: 'red',
                  message:
                    e instanceof Error ? e.message : 'Operación no disponible.',
                });
              } finally {
                setCargando(null);
              }
            }}
          >
            Generar token expirado
          </Button>
        </Group>
      </Card>
    </Card>
  );
}
