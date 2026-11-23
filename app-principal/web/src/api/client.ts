import { supabase } from './supabase';

const base = import.meta.env.VITE_API_BASE_URL ?? '';

export interface RespuestaApi<T> {
  ok: boolean;
  status: number;
  data: T | null;
  mensaje: string | null;
}

export interface OpcionesApi {
  metodo?: string;
  cuerpo?: unknown;
}

function mensajeDeError(cuerpo: unknown): string | null {
  if (cuerpo && typeof cuerpo === 'object') {
    const m = (cuerpo as Record<string, unknown>).message;
    if (Array.isArray(m)) {
      return m.join('. ');
    }
    if (typeof m === 'string') {
      return m;
    }
  }
  return null;
}

async function solicitar(
  ruta: string,
  token: string | null,
  opciones: OpcionesApi,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (opciones.cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${base}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers,
    body:
      opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });
}

export async function apiFetch<T>(
  ruta: string,
  opciones: OpcionesApi = {},
): Promise<RespuestaApi<T>> {
  const sesion = await supabase.auth.getSession();
  let token = sesion.data.session?.access_token ?? null;

  let respuesta: Response;
  try {
    respuesta = await solicitar(ruta, token, opciones);

    if (respuesta.status === 401 && token) {
      const renovada = await supabase.auth.refreshSession();
      if (renovada.data.session?.access_token) {
        token = renovada.data.session.access_token;
        respuesta = await solicitar(ruta, token, opciones);
      } else {
        await supabase.auth.signOut();
      }
    }
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      mensaje:
        'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución en el puerto 3000 y abre la aplicación usando la misma dirección (localhost) en la que inició sesión.',
    };
  }

  const texto = await respuesta.text();
  const tipo = respuesta.headers.get('content-type') ?? '';
  let cuerpo: unknown = null;
  let jsonValido = true;
  if (texto) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = texto;
      jsonValido = false;
    }
  }

  const esJson = tipo.includes('application/json') || jsonValido;
  if (respuesta.ok && (!esJson || typeof cuerpo === 'string')) {
    return {
      ok: false,
      status: respuesta.status,
      data: null,
      mensaje:
        'La respuesta del servidor no es válida. Verifica que el backend esté en ejecución y que el proxy del frontend apunte al puerto 3000.',
    };
  }

  return {
    ok: respuesta.ok,
    status: respuesta.status,
    data: respuesta.ok ? (cuerpo as T) : null,
    mensaje: respuesta.ok ? null : mensajeDeError(cuerpo),
  };
}
