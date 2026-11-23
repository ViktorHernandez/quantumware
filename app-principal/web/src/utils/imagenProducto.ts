const PALETA: Record<string, [string, string]> = {
  Periféricos: ['#4c6ef5', '#22b8cf'],
  Monitores: ['#7048e8', '#4c6ef5'],
  Accesorios: ['#0ca678', '#20c997'],
  Almacenamiento: ['#f76707', '#f59f00'],
  Redes: ['#1098ad', '#15aabf'],
  Componentes: ['#e8590c', '#f08c00'],
  Audio: ['#ae3ec9', '#be4bdb'],
};

const GENERICA: [string, string] = ['#495057', '#868e96'];

export function slugProducto(nombre: string): string {
  return nombre
    .replace(/\b(fictici[oa]s?|pulgadas?)\b/gi, ' ')
    .replace(/[″“”'"]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function rutaImagenProducto(
  nombre: string,
  imagenUrl?: string | null,
): string {
  const guardada = (imagenUrl ?? '').trim();
  if (guardada.length > 0) {
    return guardada;
  }
  return `/media/productos/${slugProducto(nombre)}.webp`;
}

function hash(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h * 31 + texto.charCodeAt(i)) % 360;
  }
  return h;
}

function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) {
    return '?';
  }
  if (palabras.length === 1) {
    return palabras[0].slice(0, 2).toUpperCase();
  }
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

export function imagenPlaceholder(
  nombre: string,
  categoria: string | null,
): string {
  const [c1, c2] = (categoria && PALETA[categoria]) || GENERICA;
  const h = hash(nombre);
  const texto = iniciales(nombre);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#g)"/>
  <circle cx="${60 + (h % 40)}" cy="${60 + (h % 30)}" r="90" fill="#ffffff" opacity="0.08"/>
  <circle cx="330" cy="250" r="70" fill="#000000" opacity="0.06"/>
  <text x="200" y="165" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.95">${texto}</text>
  <text x="200" y="230" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#ffffff" text-anchor="middle" opacity="0.85">${categoria ?? 'Producto'}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
