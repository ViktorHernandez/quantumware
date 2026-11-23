export const ETAPAS = [
  'registrado',
  'pago_aprobado',
  'procesando',
  'preparando',
  'empaquetado',
  'listo_envio',
  'enviado',
  'en_transito',
  'en_reparto',
  'entregado',
];

export const ETIQUETA_ESTADO: Record<string, string> = {
  registrado: 'Pedido recibido',
  confirmado: 'Confirmado',
  pago_aprobado: 'Pago aprobado',
  procesando: 'Procesando',
  preparando: 'En preparación',
  empaquetado: 'Empaquetado',
  listo_envio: 'Listo para envío',
  enviado: 'Enviado',
  en_transito: 'En tránsito',
  en_reparto: 'En reparto',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  devuelto: 'Devuelto',
};

export const ETIQUETA_PAGO: Record<string, string> = {
  pendiente: 'Pago pendiente',
  aprobado: 'Pago aprobado',
  rechazado: 'Pago rechazado',
};

export function colorEstado(estado: string): string {
  if (estado === 'entregado') return 'teal';
  if (estado === 'cancelado' || estado === 'devuelto') return 'red';
  if (estado === 'registrado') return 'gray';
  return 'marca';
}

export function colorPago(estado: string): string {
  if (estado === 'aprobado') return 'teal';
  if (estado === 'rechazado') return 'red';
  return 'yellow';
}

export function etiquetaEstado(estado: string): string {
  return ETIQUETA_ESTADO[estado] ?? estado;
}
