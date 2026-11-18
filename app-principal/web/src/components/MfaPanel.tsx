import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Image,
  PinInput,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconShieldCheck, IconShieldLock } from '@tabler/icons-react';
import { supabase, supabaseConfigurado } from '../api/supabase';
import { useAuth } from '../auth/authEstado';
import { traducirErrorMfa } from '../utils/erroresMfa';

interface FactorTotp {
  id: string;
  status: string;
  friendly_name?: string;
}

interface Inscripcion {
  factorId: string;
  qr: string;
  secret: string;
}

async function consultarFactores(): Promise<FactorTotp[] | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) {
    return null;
  }
  return (data.totp ?? []) as FactorTotp[];
}

export function MfaPanel() {
  const { evaluarMfa } = useAuth();
  const [factores, setFactores] = useState<FactorTotp[]>([]);
  const [inscripcion, setInscripcion] = useState<Inscripcion | null>(null);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(supabaseConfigurado);
  const [retoDesactivar, setRetoDesactivar] = useState<{
    factorId: string;
    challengeId: string;
  } | null>(null);
  const [codigoDesactivar, setCodigoDesactivar] = useState('');

  useEffect(() => {
    if (!supabaseConfigurado) {
      return;
    }
    let vigente = true;
    void consultarFactores().then((lista) => {
      if (!vigente) {
        return;
      }
      if (lista) {
        setFactores(lista);
      }
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const cargar = async () => {
    setCargando(true);
    const lista = await consultarFactores();
    if (lista) {
      setFactores(lista);
    }
    setCargando(false);
  };

  const activo = factores.find((f) => f.status === 'verified');

  const iniciarInscripcion = async () => {
    setOcupado(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `QuantumWare ${new Date().toISOString().slice(0, 10)}`,
    });
    setOcupado(false);
    if (error || !data) {
      notifications.show({
        color: 'red',
        message: error?.message ?? 'No se pudo iniciar la inscripción de MFA.',
      });
      return;
    }
    setInscripcion({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const confirmarInscripcion = async () => {
    if (!inscripcion || codigo.length !== 6) {
      return;
    }
    setOcupado(true);
    const reto = await supabase.auth.mfa.challenge({
      factorId: inscripcion.factorId,
    });
    if (reto.error || !reto.data) {
      setOcupado(false);
      notifications.show({ color: 'red', message: reto.error?.message ?? 'Error.' });
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: inscripcion.factorId,
      challengeId: reto.data.id,
      code: codigo,
    });
    setOcupado(false);
    if (error) {
      notifications.show({
        color: 'red',
        message: 'El código no es válido. Revisa tu aplicación autenticadora.',
      });
      return;
    }
    notifications.show({ color: 'teal', message: 'MFA activado correctamente.' });
    setInscripcion(null);
    setCodigo('');
    await evaluarMfa();
    await cargar();
  };

  const cancelarInscripcion = async () => {
    if (inscripcion) {
      await supabase.auth.mfa.unenroll({ factorId: inscripcion.factorId });
    }
    setInscripcion(null);
    setCodigo('');
    await cargar();
  };

  const quitarFactor = async (factorId: string): Promise<boolean> => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      notifications.show({
        color: 'red',
        message: traducirErrorMfa(error.message),
      });
      return false;
    }
    notifications.show({ color: 'teal', message: 'MFA desactivado.' });
    setRetoDesactivar(null);
    setCodigoDesactivar('');
    await evaluarMfa();
    await cargar();
    return true;
  };

  const desactivar = async () => {
    if (!activo) {
      return;
    }
    setOcupado(true);
    const nivel = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel.error) {
      setOcupado(false);
      notifications.show({
        color: 'red',
        message: traducirErrorMfa(nivel.error.message),
      });
      return;
    }
    if (nivel.data?.currentLevel === 'aal2') {
      await quitarFactor(activo.id);
      setOcupado(false);
      return;
    }
    const desafio = await supabase.auth.mfa.challenge({ factorId: activo.id });
    setOcupado(false);
    if (desafio.error || !desafio.data) {
      notifications.show({
        color: 'red',
        message: traducirErrorMfa(
          desafio.error?.message ?? 'no se pudo crear el desafío',
        ),
      });
      return;
    }
    setRetoDesactivar({ factorId: activo.id, challengeId: desafio.data.id });
  };

  const confirmarDesactivacion = async () => {
    if (!retoDesactivar || codigoDesactivar.length !== 6) {
      return;
    }
    setOcupado(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: retoDesactivar.factorId,
      challengeId: retoDesactivar.challengeId,
      code: codigoDesactivar,
    });
    if (error) {
      setOcupado(false);
      setCodigoDesactivar('');
      const mensaje = traducirErrorMfa(error.message);
      notifications.show({ color: 'red', message: mensaje });
      if (error.message.toLowerCase().includes('expired')) {
        const nuevo = await supabase.auth.mfa.challenge({
          factorId: retoDesactivar.factorId,
        });
        if (nuevo.data) {
          setRetoDesactivar({
            factorId: retoDesactivar.factorId,
            challengeId: nuevo.data.id,
          });
        }
      }
      return;
    }
    await quitarFactor(retoDesactivar.factorId);
    setOcupado(false);
  };

  const cancelarDesactivacion = () => {
    setRetoDesactivar(null);
    setCodigoDesactivar('');
  };

  return (
    <Card>
      <Stack gap="sm">
        <Group gap="xs">
          <IconShieldLock size={20} />
          <Text fw={600}>Verificación en dos pasos (MFA)</Text>
          {activo && (
            <Badge color="teal" variant="light" leftSection={<IconShieldCheck size={12} />}>
              Activa
            </Badge>
          )}
        </Group>

        {!supabaseConfigurado && (
          <Alert color="yellow">
            Configura el proveedor de identidad para habilitar MFA.
          </Alert>
        )}

        {supabaseConfigurado && !cargando && !activo && !inscripcion && (
          <>
            <Text size="sm" c="dimmed">
              Protege tu cuenta con una aplicación autenticadora compatible con
              TOTP (Google Authenticator, Authy, 1Password u otras).
            </Text>
            <Group justify="flex-end">
              <Button onClick={iniciarInscripcion} loading={ocupado}>
                Activar MFA
              </Button>
            </Group>
          </>
        )}

        {inscripcion && (
          <Stack gap="sm" align="center">
            <Text size="sm">
              Escanea este código con tu aplicación autenticadora:
            </Text>
            <Image src={inscripcion.qr} w={190} h={190} alt="Código QR de MFA" />
            <Text size="xs" c="dimmed" ta="center" style={{ wordBreak: 'break-all' }}>
              Clave manual: {inscripcion.secret}
            </Text>
            <Text size="sm">Escribe el código de 6 dígitos para confirmar:</Text>
            <PinInput length={6} value={codigo} onChange={setCodigo} type="number" oneTimeCode />
            <Group>
              <Button variant="default" onClick={cancelarInscripcion}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarInscripcion}
                loading={ocupado}
                disabled={codigo.length !== 6}
              >
                Confirmar
              </Button>
            </Group>
          </Stack>
        )}

        {activo && !inscripcion && !retoDesactivar && (
          <>
            <Text size="sm" c="dimmed">
              Tu cuenta solicita un código de tu aplicación autenticadora al
              iniciar sesión.
            </Text>
            <Group justify="flex-end">
              <Button color="red" variant="light" onClick={desactivar} loading={ocupado}>
                Desactivar MFA
              </Button>
            </Group>
          </>
        )}

        {retoDesactivar && (
          <Stack gap="sm" align="center">
            <Alert color="orange" w="100%">
              Para desactivar la verificación en dos pasos, confirma tu
              identidad con el código actual de tu aplicación autenticadora.
            </Alert>
            <PinInput
              length={6}
              value={codigoDesactivar}
              onChange={setCodigoDesactivar}
              type="number"
              oneTimeCode
              autoFocus
            />
            <Group>
              <Button variant="default" onClick={cancelarDesactivacion}>
                Cancelar
              </Button>
              <Button
                color="red"
                onClick={confirmarDesactivacion}
                loading={ocupado}
                disabled={codigoDesactivar.length !== 6}
              >
                Verificar y desactivar
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
