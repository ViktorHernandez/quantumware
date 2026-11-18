import { useEffect, useRef, useState } from 'react';
import { Alert, Anchor, Button, Stack, TextInput } from '@mantine/core';
import { IconAlertTriangle, IconMailCheck } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authEstado';
import { AuthShell } from '../components/AuthShell';

const ESPERA_SEGUNDOS = 45;

export function RecuperarPage() {
  const { enviarRecuperacion } = useAuth();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (temporizador.current) {
        clearInterval(temporizador.current);
      }
    };
  }, []);

  const iniciarEspera = () => {
    setEspera(ESPERA_SEGUNDOS);
    temporizador.current = setInterval(() => {
      setEspera((s) => {
        if (s <= 1 && temporizador.current) {
          clearInterval(temporizador.current);
          temporizador.current = null;
        }
        return s - 1;
      });
    }, 1000);
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (espera > 0) {
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Escribe un correo electrónico válido.');
      return;
    }
    setEnviando(true);
    const r = await enviarRecuperacion(email.trim());
    setEnviando(false);
    if (r.ok) {
      setEnviado(true);
      iniciarEspera();
    } else {
      setError(r.mensaje ?? 'No fue posible enviar el correo de recuperación.');
    }
  };

  return (
    <AuthShell
      titulo="Recuperar contraseña"
      descripcion="Te enviaremos un enlace para establecer una contraseña nueva."
    >
      {enviado ? (
        <Alert color="teal" icon={<IconMailCheck size={18} />}>
          Si el correo corresponde a una cuenta registrada, recibirás un enlace
          de recuperación. Revisa tu bandeja de entrada y la carpeta de correo
          no deseado.
        </Alert>
      ) : (
        <>
          {error && (
            <Alert color="red" icon={<IconAlertTriangle size={18} />}>
              {error}
            </Alert>
          )}
          <form onSubmit={enviar} noValidate>
            <Stack gap="sm">
              <TextInput
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <Button
                type="submit"
                loading={enviando}
                fullWidth
                disabled={espera > 0}
              >
                {espera > 0
                  ? `Espera ${espera}s para reenviar`
                  : 'Enviar enlace'}
              </Button>
            </Stack>
          </form>
        </>
      )}
      <Anchor component={Link} to="/login" size="sm" ta="center">
        Volver al inicio de sesión
      </Anchor>
    </AuthShell>
  );
}
