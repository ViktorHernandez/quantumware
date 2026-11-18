export function traducirErrorMfa(mensaje: string): string {
  const texto = mensaje.toLowerCase();
  if (texto.includes('invalid totp') || texto.includes('invalid code')) {
    return 'El código no es válido. Escribe el código vigente de tu aplicación autenticadora.';
  }
  if (texto.includes('expired')) {
    return 'El desafío expiró. Se generó uno nuevo; escribe el código actual de tu aplicación.';
  }
  if (texto.includes('rate') || texto.includes('too many')) {
    return 'Demasiados intentos en poco tiempo. Espera unos segundos antes de volver a intentarlo.';
  }
  if (texto.includes('factor') && texto.includes('not found')) {
    return 'El factor de autenticación ya no está disponible. Vuelve a iniciar sesión.';
  }
  if (texto.includes('aal2') || texto.includes('assurance')) {
    return 'Esta acción requiere una sesión verificada con MFA. Completa la verificación con tu código.';
  }
  return `No se pudo completar la operación de MFA: ${mensaje}`;
}
