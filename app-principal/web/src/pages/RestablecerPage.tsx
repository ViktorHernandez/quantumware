import { EstablecerCredencial } from '../components/EstablecerCredencial';

export function RestablecerPage() {
  return (
    <EstablecerCredencial
      tipoEsperado="recuperacion"
      titulo="Nueva contraseña"
      descripcion="Establece una contraseña nueva para tu cuenta."
      textoBoton="Guardar contraseña"
      rutaSolicitar="/recuperar-contrasena"
      textoSolicitar="Solicitar un enlace nuevo"
    />
  );
}
