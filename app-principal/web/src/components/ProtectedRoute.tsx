import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, Center, Loader } from '@mantine/core';
import { useAuth } from '../auth/authEstado';
import { ErrorServidor, SinPermiso } from '../pages/PaginasError';

function Encuadre({ children }: { children: ReactNode }) {
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
      {children}
    </Box>
  );
}

export function ProtectedRoute({
  children,
  soloAdmin = false,
}: {
  children: ReactNode;
  soloAdmin?: boolean;
}) {
  const {
    session,
    cargando,
    esAdmin,
    perfil,
    errorPerfil,
    recargarPerfil,
    mfaPendiente,
  } = useAuth();
  if (cargando || (session && mfaPendiente === null)) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (mfaPendiente) {
    return <Navigate to="/mfa-verificacion" replace />;
  }
  if (errorPerfil && !perfil) {
    return (
      <Encuadre>
        <ErrorServidor onReintentar={() => void recargarPerfil()} />
      </Encuadre>
    );
  }
  if (soloAdmin && !esAdmin) {
    return (
      <Encuadre>
        <SinPermiso />
      </Encuadre>
    );
  }
  return <>{children}</>;
}
