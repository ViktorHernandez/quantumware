import { useEffect, useState } from 'react';
import { Alert, Button, Center, Loader, PinInput, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconShieldLock } from '@tabler/icons-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { supabase } from '../api/supabase';
import { useAuth } from '../auth/authEstado';
import { AuthShell } from '../components/AuthShell';
import { traducirErrorMfa } from '../utils/erroresMfa';

interface Reto {
  factorId: string;
  challengeId: string;
}

export function MfaVerificacionPage() {
  const { session, cargando, mfaPendiente, evaluarMfa, recargarPerfil, cerrarSesion } =
    useAuth();
  const navigate = useNavigate();
  const [reto, setReto] = useState<Reto | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [intento, setIntento] = useState(0);

  const reintentar = () => {
    setPreparando(true);
    setError(null);
    setCodigo('');
    setReto(null);
    setIntento((n) => n + 1);
  };

  useEffect(() => {
    if (cargando || !session || !mfaPendiente) {
      return;
    }
    let vigente = true;
    const preparar = async () => {
      const factores = await supabase.auth.mfa.listFactors();
      if (!vigente) {
        return;
      }
      if (factores.error) {
        setPreparando(false);
        setError(traducirErrorMfa(factores.error.message));
        return;
      }
      const totp = factores.data?.totp?.find((f) => f.status === 'verified');
      if (!totp) {
        const sigue = await evaluarMfa();
        if (!vigente) {
          return;
        }
        setPreparando(false);
        if (!sigue) {
          return;
        }
        setError(
          'No se encontró un factor TOTP verificado para esta cuenta. Vuelve a iniciar sesión o revisa la configuración de MFA.',
        );
        return;
      }
      const desafio = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (!vigente) {
        return;
      }
      setPreparando(false);
      if (desafio.error || !desafio.data) {
        setError(
          traducirErrorMfa(
            desafio.error?.message ?? 'no se pudo crear el desafío',
          ),
        );
        return;
      }
      setReto({ factorId: totp.id, challengeId: desafio.data.id });
    };
    void preparar();
    return () => {
      vigente = false;
    };
  }, [cargando, session, mfaPendiente, intento, evaluarMfa]);

  if (cargando || mfaPendiente === null) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!mfaPendiente) {
    return <Navigate to="/u/panel" replace />;
  }

  const verificar = async () => {
    if (!reto || codigo.length !== 6) {
      return;
    }
    setVerificando(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.verify({
      factorId: reto.factorId,
      challengeId: reto.challengeId,
      code: codigo,
    });
    if (err) {
      setVerificando(false);
      const mensaje = traducirErrorMfa(err.message);
      setError(mensaje);
      setCodigo('');
      if (err.message.toLowerCase().includes('expired')) {
        reintentar();
      }
      return;
    }
    const sigePendiente = await evaluarMfa();
    setVerificando(false);
    if (sigePendiente) {
      reintentar();
      setError(
        'La sesión todavía no alcanza el nivel de verificación requerido. Intenta de nuevo.',
      );
      return;
    }
    await recargarPerfil();
    void apiFetch('/seguridad/inicio-sesion', { metodo: 'POST' });
    navigate('/u/panel', { replace: true });
  };

  const salir = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  return (
    <AuthShell
      titulo="Verificación en dos pasos"
      descripcion="Tu cuenta tiene la verificación en dos pasos activada. Escribe el código de 6 dígitos de tu aplicación autenticadora para continuar."
    >
      <Stack gap="md" align="center">
        <IconShieldLock size={34} stroke={1.6} />
        {error && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} w="100%">
            {error}
          </Alert>
        )}
        {preparando ? (
          <Loader size="sm" />
        ) : (
          <PinInput
            length={6}
            value={codigo}
            onChange={setCodigo}
            type="number"
            oneTimeCode
            autoFocus
            disabled={!reto}
          />
        )}
        <Button
          onClick={verificar}
          loading={verificando}
          disabled={!reto || codigo.length !== 6}
          fullWidth
        >
          Verificar y continuar
        </Button>
        {!preparando && (
          <Button variant="subtle" size="xs" onClick={reintentar}>
            Generar un nuevo desafío
          </Button>
        )}
        <Text size="sm" c="dimmed" ta="center">
          ¿No puedes acceder a tu aplicación autenticadora?{' '}
          <Button variant="subtle" size="compact-sm" onClick={salir} px={4}>
            Cancelar y cerrar sesión
          </Button>
        </Text>
      </Stack>
    </AuthShell>
  );
}
