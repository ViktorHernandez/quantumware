export function nombreComercial(texto: string | null | undefined): string {
  if (!texto) {
    return texto ?? '';
  }
  return texto
    .replace(/\s*\bfictici[oa]s?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}
