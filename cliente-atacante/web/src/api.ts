const base = import.meta.env.VITE_CLIENT_API_BASE ?? '';

export async function apiGet<T>(ruta: string): Promise<T> {
  const r = await fetch(`${base}${ruta}`);
  const texto = await r.text();
  const cuerpo = texto ? JSON.parse(texto) : null;
  if (!r.ok) {
    throw new Error((cuerpo && cuerpo.message) || `Error ${r.status}`);
  }
  return cuerpo as T;
}

export async function apiPost<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!r.ok) {
    throw new Error((datos && datos.message) || `Error ${r.status}`);
  }
  return datos as T;
}
