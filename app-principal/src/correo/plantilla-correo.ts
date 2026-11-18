export interface DetalleCorreo {
  etiqueta: string;
  valor: string;
}

export interface ContenidoCorreo {
  titulo: string;
  mensaje: string;
  fecha?: Date;
  detalles?: DetalleCorreo[];
}

const ETIQUETAS_DATOS: Record<string, string> = {
  pedido_id: 'Pedido',
  producto_id: 'Producto',
  numero_seguimiento: 'Número de seguimiento',
  rol: 'Rol asignado',
  stock: 'Existencias',
  tipo: 'Tipo de movimiento',
  estado: 'Estado',
};

function acortar(valor: string): string {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      valor,
    )
  ) {
    return valor.slice(0, 8).toUpperCase();
  }
  return valor;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function detallesDeDatos(
  datos: Record<string, unknown> | undefined,
): DetalleCorreo[] {
  if (!datos) {
    return [];
  }
  const detalles: DetalleCorreo[] = [];
  for (const [clave, etiqueta] of Object.entries(ETIQUETAS_DATOS)) {
    const valor = datos[clave];
    if (
      (typeof valor === 'string' && valor !== '') ||
      typeof valor === 'number'
    ) {
      detalles.push({ etiqueta, valor: acortar(String(valor)) });
    }
  }
  return detalles;
}

export function asuntoCorreo(titulo: string): string {
  return `QuantumWare · ${titulo}`;
}

export function plantillaCorreo(contenido: ContenidoCorreo): string {
  const fecha = contenido.fecha ?? new Date();
  const fechaTexto = fecha.toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });
  const titulo = escaparHtml(contenido.titulo);
  const mensaje = escaparHtml(contenido.mensaje);
  const detalles = contenido.detalles ?? [];

  const filasDetalles = detalles
    .map(
      (d) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #edf0f7;color:#6b7390;font-size:13px;white-space:nowrap">${escaparHtml(d.etiqueta)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #edf0f7;color:#1b2440;font-size:13px;font-weight:600">${escaparHtml(d.valor)}</td>
      </tr>`,
    )
    .join('');

  const tablaDetalles =
    detalles.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;border:1px solid #edf0f7;border-radius:8px;border-collapse:separate;overflow:hidden">
          ${filasDetalles}
        </table>`
      : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f9;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e7f0">
          <tr>
            <td style="background:#283593;padding:20px 28px">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px">QuantumWare</span>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c3c9ef;display:block;margin-top:2px">Gestión de inventario y pedidos</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#95a0b8;margin:0 0 12px">${fechaTexto}</p>
              <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:20px;color:#1b2440;margin:0 0 12px">${titulo}</h1>
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4a5270;margin:0">${mensaje}</p>
              ${tablaDetalles}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f8f9fc;border-top:1px solid #edf0f7">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#95a0b8;margin:0;line-height:1.5">
                Recibes este mensaje porque tienes una cuenta en QuantumWare.
                Este es un entorno académico de laboratorio con datos ficticios.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
