SET client_encoding TO 'UTF8';

CREATE OR REPLACE FUNCTION qw_clave_catalogo(nombre text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      lower(
        translate(
          regexp_replace(
            coalesce(nombre, ''),
            '\m(fictici[oa]s?|pulgadas?)\M',
            ' ',
            'gi'
          ),
          'áéíóúüñÁÉÍÓÚÜÑ″“”''"',
          'aeiouunAEIOUUN'
        )
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

WITH canonico (clave, nombre_final, ruta) AS (
    VALUES
      ('audifonos', 'Audífonos', '/media/productos/audifonos.webp'),
      ('bocina-compacta', 'Bocina compacta', '/media/productos/bocina-compacta.webp'),
      ('cable-displayport', 'Cable DisplayPort', '/media/productos/cable-displayport.webp'),
      ('cable-hdmi', 'Cable HDMI', '/media/productos/cable-hdmi.webp'),
      ('disco-externo-2-tb', 'Disco externo 2 TB', '/media/productos/disco-externo-2-tb.webp'),
      ('fuente-de-poder-650-w', 'Fuente de poder 650 W', '/media/productos/fuente-de-poder-650-w.webp'),
      ('hub-usb-c', 'Hub USB-C', '/media/productos/hub-usb-c.webp'),
      ('memoria-ram-16-gb', 'Memoria RAM 16 GB', '/media/productos/memoria-ram-16-gb.webp'),
      ('memoria-usb-64-gb', 'Memoria USB 64 GB', '/media/productos/memoria-usb-64-gb.webp'),
      ('microfono-usb', 'Micrófono USB', '/media/productos/microfono-usb.webp'),
      ('monitor-curvo-27', 'Monitor curvo 27 pulgadas', '/media/productos/monitor-curvo-27.webp'),
      ('monitor-de-prueba-24', 'Monitor de prueba 24″', '/media/productos/monitor-de-prueba-24.webp'),
      ('monitor-portatil-15', 'Monitor portátil 15 pulgadas', '/media/productos/monitor-portatil-15.webp'),
      ('mouse-optico', 'Mouse óptico', '/media/productos/mouse-optico.webp'),
      ('router-de-prueba', 'Router de prueba', '/media/productos/router-de-prueba.webp'),
      ('ssd-nvme-1-tb', 'SSD NVMe 1 TB', '/media/productos/ssd-nvme-1-tb.webp'),
      ('switch-de-red-8-puertos', 'Switch de red 8 puertos', '/media/productos/switch-de-red-8-puertos.webp'),
      ('tarjeta-de-red', 'Tarjeta de red', '/media/productos/tarjeta-de-red.webp'),
      ('teclado-compacto', 'Teclado compacto', '/media/productos/teclado-compacto.webp'),
      ('teclado-mecanico', 'Teclado mecánico', '/media/productos/teclado-mecanico.webp'),
      ('ventilador-120-mm', 'Ventilador 120 mm', '/media/productos/ventilador-120-mm.webp')
)
UPDATE producto p
SET nombre = c.nombre_final,
    imagen_url = coalesce(p.imagen_url, c.ruta)
FROM canonico c
WHERE qw_clave_catalogo(p.nombre) = c.clave
  AND (p.nombre <> c.nombre_final OR p.imagen_url IS NULL);

UPDATE producto
SET descripcion = regexp_replace(descripcion, '\m(fictici[oa]s?)\M\s*', '', 'gi')
WHERE descripcion ~* '\mfictici[oa]s?\M';

UPDATE producto
SET descripcion = trim(regexp_replace(descripcion, '\s{2,}', ' ', 'g'))
WHERE descripcion <> trim(regexp_replace(descripcion, '\s{2,}', ' ', 'g'));

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('17_normalizar_nombres_catalogo.sql')
ON CONFLICT (archivo) DO NOTHING;
