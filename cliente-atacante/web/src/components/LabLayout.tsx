import type { ReactNode } from 'react';
import {
  AppShell,
  Badge,
  Burger,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MarcaLab } from './MarcaLab';
import {
  IconActivity,
  IconAdjustments,
  IconFileText,
  IconHistory,
  IconLayoutDashboard,
  IconLock,
  IconPrompt,
  IconShieldBolt,
  IconTerminal2,
  IconUsers,
} from '@tabler/icons-react';
import {
  NavLink as RouterNavLink,
  useLocation,
} from 'react-router-dom';
import { useEffect } from 'react';
import { useLab } from '../store/labEstado';

interface Seccion {
  ruta: string;
  etiqueta: string;
  icono: ReactNode;
}

const SECCIONES: Seccion[] = [
  { ruta: '/panel', etiqueta: 'Panel del laboratorio', icono: <IconLayoutDashboard size={18} /> },
  { ruta: '/sesiones', etiqueta: 'Sesiones', icono: <IconUsers size={18} /> },
  { ruta: '/funcionales', etiqueta: 'Pruebas funcionales', icono: <IconActivity size={18} /> },
  { ruta: '/vulnerabilidades', etiqueta: 'Laboratorio de vulnerabilidades', icono: <IconShieldBolt size={18} /> },
  { ruta: '/autorizacion', etiqueta: 'Pruebas de autorización', icono: <IconLock size={18} /> },
  { ruta: '/terminal', etiqueta: 'Terminal', icono: <IconTerminal2 size={18} /> },
  { ruta: '/consola', etiqueta: 'Consola visual', icono: <IconPrompt size={18} /> },
  { ruta: '/historial', etiqueta: 'Historial', icono: <IconHistory size={18} /> },
  { ruta: '/evidencias', etiqueta: 'Evidencias', icono: <IconFileText size={18} /> },
  { ruta: '/configuracion', etiqueta: 'Configuración', icono: <IconAdjustments size={18} /> },
];

export function LabLayout({ children }: { children: ReactNode }) {
  const { config } = useLab();
  const [abierto, { toggle, close }] = useDisclosure(false);
  const location = useLocation();

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  const modo = config?.vulnMode ?? 'desconocido';

  return (
    <AppShell
      header={{ height: 58 }}
      navbar={{ width: 270, breakpoint: 'sm', collapsed: { mobile: !abierto } }}
      padding="lg"
    >
      <AppShell.Header style={{ borderBottom: '1px solid #e6e8ee', background: '#ffffff' }}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={abierto} onClick={toggle} hiddenFrom="sm" size="sm" />
            <MarcaLab size={24} />
            <Text fw={700}>QuantumWare · Laboratorio</Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            {config && (
              <>
                <Badge variant="light" color="gray" visibleFrom="xs">
                  Objetivo {config.objetivo}
                </Badge>
                <Badge color={modo === 'vulnerable' ? 'red' : 'teal'} variant="filled">
                  Modo: {modo}
                </Badge>
              </>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar style={{ background: '#140f12', border: 'none' }}>
        <AppShell.Section p="md">
          <Group gap="sm">
            <MarcaLab size={26} variant="outline" />
            <div style={{ lineHeight: 1.1 }}>
              <Text c="white" fw={700} fz="md">
                Cliente atacante
              </Text>
              <Text c="#b08b90" fz={10} tt="uppercase" fw={600}>
                Laboratorio local
              </Text>
            </div>
          </Group>
        </AppShell.Section>
        <Divider color="#39282c" />
        <AppShell.Section grow component={ScrollArea} p="sm">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.ruta}
              component={RouterNavLink}
              to={s.ruta}
              label={s.etiqueta}
              leftSection={s.icono}
              className="qw-lab-nav"
              mb={4}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section p="md">
          <Badge variant="light" color="red" fullWidth size="sm">
            Uso académico local
          </Badge>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
