import { Box, Stack } from '@mantine/core';
import {
  IconArrowLeft,
  IconHome,
  IconLockExclamation,
  IconRefresh,
  IconServerBolt,
  IconZoomQuestion,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { EstadoResultado } from '../components/EstadoResultado';
import { Marca } from '../components/Marca';

function Encuadre({ children }: { children: React.ReactNode }) {
  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--qw-fondo)',
      }}
    >
      <Stack align="center" gap={0} w="100%">
        <Box mt="xl">
          <Marca size={40} />
        </Box>
        {children}
      </Stack>
    </Box>
  );
}

export function NoEncontrado() {
  const navigate = useNavigate();
  return (
    <Encuadre>
      <EstadoResultado
        icono={IconZoomQuestion}
        titulo="Página no encontrada"
        descripcion="La dirección que abriste no existe o se movió. Verifica el enlace o vuelve al panel principal."
        acciones={[
          {
            etiqueta: 'Volver al inicio',
            icono: <IconHome size={16} />,
            onClick: () => navigate('/u/panel'),
          },
          {
            etiqueta: 'Regresar',
            variante: 'default',
            icono: <IconArrowLeft size={16} />,
            onClick: () => navigate(-1),
          },
        ]}
      />
    </Encuadre>
  );
}

export function SinPermiso() {
  const navigate = useNavigate();
  return (
    <EstadoResultado
      icono={IconLockExclamation}
      color="orange"
      titulo="No tienes permisos para esta sección"
      descripcion="Tu cuenta no cuenta con los privilegios necesarios para ver o realizar esta operación. Si crees que es un error, solicita el rol correspondiente a un administrador."
      acciones={[
        {
          etiqueta: 'Ir a mi inicio',
          icono: <IconHome size={16} />,
          onClick: () => navigate('/u/panel'),
        },
      ]}
    />
  );
}

export function ErrorServidor({ onReintentar }: { onReintentar?: () => void }) {
  return (
    <EstadoResultado
      icono={IconServerBolt}
      color="red"
      titulo="No pudimos completar la operación"
      descripcion="Ocurrió un problema de comunicación con el servidor. Revisa tu conexión e inténtalo de nuevo; si continúa, confirma que el servicio esté en ejecución."
      acciones={
        onReintentar
          ? [
              {
                etiqueta: 'Reintentar',
                icono: <IconRefresh size={16} />,
                onClick: onReintentar,
              },
            ]
          : undefined
      }
    />
  );
}
