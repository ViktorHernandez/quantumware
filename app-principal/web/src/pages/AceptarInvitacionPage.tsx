import { EstablecerCredencial } from '../components/EstablecerCredencial';

export function AceptarInvitacionPage() {
  return (
    <EstablecerCredencial
      tipoEsperado="invitacion"
      titulo="Aceptar invitación"
      descripcion="Establece tu contraseña para activar tu cuenta de QuantumWare."
      textoBoton="Crear mi cuenta"
      rutaSolicitar="/login"
      textoSolicitar="Ir al inicio de sesión"
    />
  );
}
