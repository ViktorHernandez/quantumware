const monedaFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

export function moneda(valor: string | number | null | undefined): string {
  const n = Number(valor ?? 0);
  return monedaFmt.format(Number.isFinite(n) ? n : 0);
}

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) {
    return '—';
  }
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function diaCorto(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
}

export function identificadorCorto(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
