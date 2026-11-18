const hrefInicial =
  typeof window === 'undefined' ? '' : window.location.href;

function parametros(href: string): URLSearchParams {
  const combinados = new URLSearchParams();
  try {
    const url = new URL(href);
    url.searchParams.forEach((valor, clave) => combinados.set(clave, valor));
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    hash.forEach((valor, clave) => {
      if (!combinados.has(clave)) {
        combinados.set(clave, valor);
      }
    });
  } catch {
    return combinados;
  }
  return combinados;
}

const parametrosIniciales = parametros(hrefInicial);

export function parametrosArranque(): URLSearchParams {
  return new URLSearchParams(parametrosIniciales.toString());
}

export function arranqueTieneCodigo(): boolean {
  return (
    parametrosIniciales.has('code') || parametrosIniciales.has('access_token')
  );
}

export function arranqueTipo(): string | null {
  return parametrosIniciales.get('type');
}

export function arranqueError(): string | null {
  return (
    parametrosIniciales.get('error_description') ??
    parametrosIniciales.get('error') ??
    null
  );
}
