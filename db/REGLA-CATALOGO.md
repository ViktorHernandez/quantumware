# QuantumWare — Regla permanente del catálogo de productos

Vigente desde el 21-nov-2026. Aplica a datos semilla, migraciones, altas desde la
interfaz, restauraciones y despliegues, en la base local y en Supabase.

## La regla

1. Los nombres de productos NO deben contener la palabra «ficticio» ni sus
   variantes («ficticia», «ficticios», «ficticias»). Tampoco sus descripciones.
   Los nombres visibles deben ser naturales y utilizables en un catálogo:
   «Audífonos», «Cable HDMI», «Memoria USB 64 GB», «Monitor curvo 27 pulgadas».
2. La asociación entre un producto y su imagen NO debe depender de que el nombre
   contenga o no esa palabra, ni de coincidencias exactas de texto.
3. La fuente de verdad de la imagen es la columna `producto.imagen_url`. La
   resolución por nombre es solo un respaldo.

## Mecanismo de asociación estable

La clave de catálogo se obtiene normalizando el nombre: se eliminan los tokens
«ficticio/a/s» y «pulgada/s», el símbolo ″ y las comillas, se quitan los acentos
y lo que no sea alfanumérico se convierte en guiones. El resultado coincide con
el nombre de archivo de la imagen en `app-principal/web/public/media/productos/`.

Implementada en tres lugares que deben mantenerse equivalentes:
- SQL: función `qw_clave_catalogo(text)`, creada por `db/17_normalizar_nombres_catalogo.sql`.
- Backend: `slugCatalogo()` en `app-principal/src/productos/productos.service.ts`.
- Frontend: `slugProducto()` en `app-principal/web/src/utils/imagenProducto.ts`.

Así, «Audífonos ficticios», «Audífonos», «Monitor curvo ficticio 27»,
«Monitor curvo 27″» y «Monitor curvo 27 pulgadas» resuelven todos la misma imagen.

## Preparación reproducible de la base de pruebas

Las pruebas E2E usan una base de datos **dedicada**, nunca la de desarrollo:

- `app-principal/test/configuracion-e2e.ts` fuerza `DATABASE_NAME` a
  `quantumware_pruebas` (configurable con `TEST_DATABASE_NAME`) y **aborta** si el
  nombre no contiene «prueba» ni «test». Así ninguna prueba puede alterar datos
  reales, correos en cola ni destinatarios reales.
- `app-principal/scripts/aplicar-migraciones.mjs` aplica todos los `db/*.sql` en
  orden de nombre, uno por transacción, registrando cada uno en
  `schema_migrations` y omitiendo los ya aplicados. Usa el paquete `pg`, así que
  no necesita `psql` en el PATH de Windows. Con `--crear` crea la base si falta.
- `npm run test:e2e` ejecuta esa preparación automáticamente mediante
  `pretest:e2e`. También puede invocarse sola con `npm run db:preparar-pruebas`,
  y `npm run db:migrar` aplica las migraciones a la base de desarrollo.

## Protecciones automáticas

- `db/17_normalizar_nombres_catalogo.sql` normaliza nombres y descripciones y
  completa `imagen_url`. Es idempotente y no borra datos ni cambia identificadores.
- Al arrancar, `ProductosService` completa las imágenes faltantes y **advierte en
  el registro** si algún producto conserva la palabra reservada o queda sin imagen.
- `app-principal/test/catalogo-nombres.e2e-spec.ts` falla si la palabra reaparece
  en un nombre o descripción, si un producto que **sí tiene ilustración
  disponible** no la tiene asignada o la tiene incorrecta, si alguna `imagen_url`
  apunta a un archivo inexistente, si dos productos comparten imagen, si la
  migración 17 no está registrada, o si un archivo SQL del proyecto vuelve a
  introducir la palabra en un nombre o descripción.

## Alcance del invariante de imágenes

La regla de nombres y descripciones aplica a **todos** los productos. La de
imágenes no exige que todo producto tenga ilustración: el conjunto de
demostración (`db/demo/datos-demostracion.sql`) agrega productos de marca
inventada (D01 a D25) para los que no existe archivo, y la interfaz muestra para
ellos un marcador con iniciales y categoría, que es el comportamiento previsto.
Lo que sí se exige es que todo producto cuya clave de catálogo corresponda a un
archivo existente lo tenga asignado, y que ninguna `imagen_url` apunte a un
archivo que no exista.

## Antes de sembrar, migrar o insertar productos

Verificar que el nombre no contenga la palabra reservada y que su clave de
catálogo corresponda a un archivo existente. No inventar rutas de imagen.

## Nota académica

La Tabla 3 del protocolo entregado nombra los productos con la palabra
«ficticio». El catálogo implementado usa nombres naturales, así que esta
diferencia debe declararse en el apartado de cambios posteriores al alcance
aprobado del reporte final.
