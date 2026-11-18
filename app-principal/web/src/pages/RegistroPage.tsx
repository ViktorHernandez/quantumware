import { useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  List,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  useMantineTheme,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconCircleDashed,
  IconLock,
  IconMailForward,
  IconShieldCheck,
  IconUserPlus,
} from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authEstado';
import { Marca } from '../components/Marca';

interface Requisito {
  etiqueta: string;
  cumple: (password: string) => boolean;
}

const REQUISITOS: Requisito[] = [
  { etiqueta: 'Al menos 8 caracteres', cumple: (p) => p.length >= 8 },
  {
    etiqueta: 'Mayúsculas y minúsculas',
    cumple: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p),
  },
  {
    etiqueta: 'Un número o un símbolo',
    cumple: (p) => /[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p),
  },
];

function traducirErrorRegistro(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('already registered') || m.includes('ya existe una cuenta')) {
    return 'Ya existe una cuenta con este correo electrónico.';
  }
  if (m.includes('password should be at least')) {
    return 'La contraseña no cumple la longitud mínima del proveedor de identidad.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Se enviaron demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.';
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'El correo electrónico no es válido para el proveedor de identidad.';
  }
  if (m.includes('signups not allowed')) {
    return 'El proveedor de identidad tiene deshabilitado el registro de cuentas nuevas.';
  }
  return 'No fue posible crear la cuenta. Inténtalo de nuevo más tarde.';
}

function Lienzo({ children }: { children: React.ReactNode }) {
  const theme = useMantineTheme();
  return (
    <Box style={{ minHeight: '100vh', background: theme.other.superficie }}>
      <Box
        style={{
          height: 6,
          background: theme.other.gradienteMarca,
        }}
      />
      <Center px="md" py={48}>
        <Stack w="100%" maw={560} gap="lg">
          <Group justify="center" gap="sm">
            <Marca size={34} />
            <div style={{ lineHeight: 1.1 }}>
              <Text fw={800} fz="lg">
                QuantumWare
              </Text>
              <Text fz={10} tt="uppercase" fw={700} c="dimmed">
                Gestión de inventario y pedidos
              </Text>
            </div>
          </Group>
          {children}
        </Stack>
      </Center>
    </Box>
  );
}

export function RegistroPage() {
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const { registroAbierto, registrarse } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!registroAbierto) {
    return (
      <Lienzo>
        <Card padding="xl">
          <Stack align="center" gap="md" py="md">
            <ThemeIcon size={56} radius="xl" variant="light" color="gray">
              <IconLock size={28} />
            </ThemeIcon>
            <Title order={2} ta="center">
              El registro está deshabilitado
            </Title>
            <Text c="dimmed" ta="center" maw={400}>
              Esta instalación de QuantumWare no acepta cuentas nuevas por
              autoservicio. Solicita el alta a la persona administradora del
              sistema.
            </Text>
            <Button
              variant="light"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/login')}
            >
              Volver al inicio de sesión
            </Button>
          </Stack>
        </Card>
      </Lienzo>
    );
  }

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      e.email = 'Escribe un correo electrónico válido.';
    }
    if (!REQUISITOS.every((r) => r.cumple(password))) {
      e.password = 'La contraseña no cumple todos los requisitos.';
    }
    if (confirmacion !== password || confirmacion.length === 0) {
      e.confirmacion = 'Las contraseñas no coinciden.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErrorGeneral(null);
    if (!validar()) {
      return;
    }
    setEnviando(true);
    const r = await registrarse(email.trim(), password);
    setEnviando(false);
    if (r.ok) {
      setListo(true);
    } else {
      setErrorGeneral(traducirErrorRegistro(r.mensaje ?? ''));
    }
  };

  if (listo) {
    return (
      <Lienzo>
        <Card padding="xl">
          <Stack gap="lg">
            <Group gap="sm">
              <ThemeIcon size={44} radius="xl" color="acento" variant="light">
                <IconMailForward size={24} />
              </ThemeIcon>
              <div>
                <Title order={2}>Revisa tu correo</Title>
                <Text size="sm" c="dimmed">
                  Enviamos un enlace de confirmación a {email.trim()}
                </Text>
              </div>
            </Group>
            <Divider />
            <List spacing="md" type="ordered">
              <List.Item>
                Abre el mensaje del proveedor de identidad y confirma tu
                dirección de correo.
              </List.Item>
              <List.Item>
                Regresa e inicia sesión con tu correo y contraseña.
              </List.Item>
              <List.Item>
                Tu cuenta entrará con el rol de cliente; solo una persona
                administradora puede ampliar permisos desde el servidor.
              </List.Item>
            </List>
            <Button component={Link} to="/login" fullWidth>
              Ir a iniciar sesión
            </Button>
          </Stack>
        </Card>
      </Lienzo>
    );
  }

  return (
    <Lienzo>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <Box
          px="xl"
          py="lg"
          style={{ background: theme.other.gradienteMarca, color: '#fff' }}
        >
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" variant="white" color="marca">
              <IconUserPlus size={22} />
            </ThemeIcon>
            <div>
              <Title order={2} c="#fff">
                Crea tu cuenta
              </Title>
              <Text size="sm" style={{ opacity: 0.85 }}>
                Acceso de cliente al catálogo y a tus pedidos
              </Text>
            </div>
          </Group>
        </Box>

        <Stack gap="md" p="xl">
          {errorGeneral && (
            <Alert color="red" icon={<IconAlertTriangle size={18} />}>
              {errorGeneral}
            </Alert>
          )}
          <form onSubmit={enviar} noValidate>
            <Stack gap="md">
              <TextInput
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                placeholder="persona@correo.com"
                value={email}
                error={errores.email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <div>
                <PasswordInput
                  label="Contraseña"
                  autoComplete="new-password"
                  value={password}
                  error={errores.password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                />
                <Stack gap={4} mt={8}>
                  {REQUISITOS.map((r) => {
                    const ok = r.cumple(password);
                    return (
                      <Group key={r.etiqueta} gap={8}>
                        {ok ? (
                          <IconCircleCheck
                            size={16}
                            color="var(--mantine-color-acento-7)"
                          />
                        ) : (
                          <IconCircleDashed
                            size={16}
                            color="var(--mantine-color-gray-5)"
                          />
                        )}
                        <Text size="xs" c={ok ? 'teal.8' : 'dimmed'}>
                          {r.etiqueta}
                        </Text>
                      </Group>
                    );
                  })}
                </Stack>
              </div>
              <PasswordInput
                label="Confirmar contraseña"
                autoComplete="new-password"
                value={confirmacion}
                error={errores.confirmacion}
                onChange={(e) => setConfirmacion(e.currentTarget.value)}
                rightSection={
                  confirmacion.length > 0 && confirmacion === password ? (
                    <IconCircleCheck
                      size={18}
                      color="var(--mantine-color-acento-7)"
                    />
                  ) : null
                }
              />
              <Button
                type="submit"
                size="md"
                loading={enviando}
                fullWidth
                leftSection={<IconUserPlus size={18} />}
              >
                Crear cuenta
              </Button>
            </Stack>
          </form>
          <Group gap={8} justify="center">
            <IconShieldCheck size={15} color="var(--mantine-color-gray-6)" />
            <Text size="xs" c="dimmed">
              Tus credenciales se gestionan en el proveedor de identidad; esta
              aplicación nunca almacena tu contraseña.
            </Text>
          </Group>
        </Stack>
      </Card>

      <Group justify="center" gap={6}>
        <Text size="sm" c="dimmed">
          ¿Ya tienes cuenta?
        </Text>
        <Anchor component={Link} to="/login" size="sm" fw={600}>
          Iniciar sesión
        </Anchor>
        <Badge variant="light" color="gray" ml="xs">
          Proyecto académico
        </Badge>
      </Group>
    </Lienzo>
  );
}
