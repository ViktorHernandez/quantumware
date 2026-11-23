export type OrigenToken =
  'ninguno' | 'admin' | 'cliente' | 'alterado' | 'expirado' | 'personalizado';

export interface DefinicionEscenario {
  id: string;
  titulo: string;
  tipo: 'funcional' | 'explotacion' | 'autorizacion';
  metodo: string;
  ruta: string;
  origenToken: OrigenToken;
  descripcion: string;
  preparacion: string;
  esperadoBase: string;
  dependeDeModo?: boolean;
  requiereProducto?: boolean;
  requierePedidoObjetivo?: boolean;
  restablecimiento?: string;
}

export const ESCENARIOS: DefinicionEscenario[] = [
  {
    id: 'PF-01',
    titulo: 'Funcionamiento normal de la búsqueda',
    tipo: 'funcional',
    metodo: 'GET',
    ruta: '/productos/buscar?q=teclado',
    origenToken: 'cliente',
    descripcion:
      'Búsqueda legítima con un término existente usando un token de cliente válido.',
    preparacion:
      'Inicia sesión como cliente. Funciona en ambas versiones del backend.',
    esperadoBase:
      'Responde 200 y devuelve únicamente los productos cuyo nombre coincide con el término.',
    restablecimiento: 'No modifica datos; no requiere restablecimiento.',
  },
  {
    id: 'PE-01',
    titulo: 'Explotación de la inyección SQL',
    tipo: 'explotacion',
    metodo: 'GET',
    ruta: "/productos/buscar?q=%' OR '1'='1' --",
    origenToken: 'cliente',
    descripcion:
      'Envía una carga de inyección ficticia al parámetro de búsqueda y compara con PF-01.',
    preparacion:
      'Inicia sesión como cliente. El resultado esperado depende del VULN_MODE del backend.',
    esperadoBase:
      'Vulnerable: devuelve registros que la búsqueda legítima no devolvería (los tres del catálogo). Corregido: trata la carga como texto literal y no devuelve registros adicionales.',
    dependeDeModo: true,
    restablecimiento:
      'No modifica datos; solo se alterna la versión del backend para repetir.',
  },
  {
    id: 'PE-02',
    titulo: 'Omisión de la validación del lado del cliente',
    tipo: 'explotacion',
    metodo: 'POST',
    ruta: '/pedidos',
    origenToken: 'cliente',
    descripcion:
      'Omite el formulario y envía directamente un pedido con una cantidad superior al límite de 10.',
    preparacion:
      'Inicia sesión como cliente. El resultado esperado depende del VULN_MODE del backend.',
    esperadoBase:
      'Vulnerable: responde 201 y registra el pedido con la cantidad fuera de límite. Corregido: responde 400 y no lo registra.',
    dependeDeModo: true,
    requiereProducto: true,
    restablecimiento:
      'En la versión vulnerable se elimina el pedido de prueba con limpiar-pedidos-prueba.ps1.',
  },
  {
    id: 'PE-03',
    titulo: 'Acceso a un pedido de otro cliente (BOLA/IDOR)',
    tipo: 'explotacion',
    metodo: 'GET',
    ruta: '/pedidos/OBJETIVO',
    origenToken: 'cliente',
    descripcion:
      'Con la sesión de un cliente autenticado se solicita el pedido de otro cliente por su identificador, para comprobar si el servidor verifica la propiedad del recurso.',
    preparacion:
      'Captura la sesión de cliente (atacante) y la de administrador. Pulsa «Descubrir pedidos de otros clientes» para listar los pedidos de laboratorio y cargar el identificador de uno que pertenezca a OTRO cliente. El resultado esperado depende del VULN_MODE del backend.',
    esperadoBase:
      'Vulnerable: responde 200 y revela el pedido ajeno. Corregido: responde 403 y no expone datos del propietario.',
    dependeDeModo: true,
    requierePedidoObjetivo: true,
    restablecimiento:
      'No modifica datos: solo consulta. No requiere restablecimiento.',
  },
  {
    id: 'PE-04',
    titulo: 'Resistencia a intentos repetidos de autenticación',
    tipo: 'explotacion',
    metodo: 'POST',
    ruta: '/lab/resistencia-autenticacion',
    origenToken: 'cliente',
    descripcion:
      'Ejecuta una simulación acotada de intentos repetidos de autenticación contra una cuenta ficticia de laboratorio, para comprobar si el servidor limita y bloquea los intentos. No usa credenciales reales ni el proveedor de identidad.',
    preparacion:
      'Captura la sesión de cliente. La simulación está limitada por el servidor a un máximo de 20 intentos y se detiene automáticamente. El comportamiento depende del VULN_MODE del backend.',
    esperadoBase:
      'Vulnerable: procesa todos los intentos sin bloqueo. Corregido: bloquea los intentos a partir del umbral de protección.',
    dependeDeModo: true,
    restablecimiento:
      'No modifica datos: es una simulación en memoria. No requiere restablecimiento.',
  },
  {
    id: 'PA-01',
    titulo: 'Acceso con token válido y permisos suficientes',
    tipo: 'autorizacion',
    metodo: 'POST',
    ruta: '/productos',
    origenToken: 'admin',
    descripcion:
      'Operación de administración de productos con el token de administrador.',
    preparacion: 'Inicia sesión como administrador.',
    esperadoBase: 'Responde 201 y ejecuta la operación.',
    restablecimiento:
      'Se elimina automáticamente el producto de prueba creado.',
  },
  {
    id: 'PA-02',
    titulo: 'Acceso sin token',
    tipo: 'autorizacion',
    metodo: 'GET',
    ruta: '/pedidos',
    origenToken: 'ninguno',
    descripcion: 'Solicitud a una ruta protegida sin cabecera de autorización.',
    preparacion: 'No requiere sesión.',
    esperadoBase: 'Responde 401 y no devuelve pedidos.',
    restablecimiento: 'No requiere restablecimiento.',
  },
  {
    id: 'PA-03',
    titulo: 'Acceso con token alterado',
    tipo: 'autorizacion',
    metodo: 'GET',
    ruta: '/pedidos',
    origenToken: 'alterado',
    descripcion:
      'Modifica la carga útil (el sub) del token de cliente sin volver a firmarlo, para suplantar a otro usuario.',
    preparacion: 'Inicia sesión como cliente.',
    esperadoBase: 'Responde 401 al fallar la verificación de la firma.',
    restablecimiento: 'No requiere restablecimiento.',
  },
  {
    id: 'PA-04',
    titulo: 'Acceso con token expirado',
    tipo: 'autorizacion',
    metodo: 'GET',
    ruta: '/pedidos',
    origenToken: 'expirado',
    descripcion:
      'Envía un token auténtico cuya marca de expiración ya venció. El cliente no renueva el token.',
    preparacion:
      'Pulsa «Generar token expirado» en Sesiones para que el laboratorio emita un token ya vencido, firmado con una clave que el servidor acepta; o pega un token cuya marca «exp» ya haya pasado. No se usa un token vigente ni falsificado.',
    esperadoBase: 'Responde 401 al comprobar la expiración.',
    restablecimiento:
      'No modifica datos: el token de laboratorio es efímero y solo sirve para esta comprobación. No requiere restablecimiento.',
  },
  {
    id: 'PA-05',
    titulo: 'Acceso con token válido pero sin permisos',
    tipo: 'autorizacion',
    metodo: 'POST',
    ruta: '/productos',
    origenToken: 'cliente',
    descripcion:
      'Operación de administración de productos con el token de un usuario cliente.',
    preparacion: 'Inicia sesión como cliente.',
    esperadoBase: 'Responde 403 por permisos insuficientes.',
    restablecimiento: 'No requiere restablecimiento; el producto no se crea.',
  },
];

export function productoDePrueba() {
  return {
    nombre: 'Producto de prueba (laboratorio)',
    descripcion:
      'Producto ficticio creado durante las pruebas de autorización de QuantumWare.',
    categoria: 'Pruebas',
    precio: 100.0,
    stock: 1,
  };
}
