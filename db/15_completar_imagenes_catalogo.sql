-- Completa imagen_url de los productos estándar del catálogo QuantumWare.
-- Es idempotente: solo modifica registros que actualmente no tienen imagen.
-- Ejecutar en Supabase SQL Editor después de revisar el SELECT de previsualización.

SELECT id, nombre, imagen_url,
       CASE nombre
         WHEN 'Teclado mecánico' THEN '/media/productos/teclado-mecanico.webp'
         WHEN 'Monitor de prueba 24″' THEN '/media/productos/monitor-de-prueba-24.webp'
         WHEN 'Cable HDMI' THEN '/media/productos/cable-hdmi.webp'
         WHEN 'Teclado compacto' THEN '/media/productos/teclado-compacto.webp'
         WHEN 'Mouse óptico' THEN '/media/productos/mouse-optico.webp'
         WHEN 'Monitor curvo 27″' THEN '/media/productos/monitor-curvo-27.webp'
         WHEN 'Monitor portátil 15″' THEN '/media/productos/monitor-portatil-15.webp'
         WHEN 'Cable DisplayPort' THEN '/media/productos/cable-displayport.webp'
         WHEN 'Hub USB-C' THEN '/media/productos/hub-usb-c.webp'
         WHEN 'SSD NVMe 1 TB' THEN '/media/productos/ssd-nvme-1-tb.webp'
         WHEN 'Disco externo 2 TB' THEN '/media/productos/disco-externo-2-tb.webp'
         WHEN 'Memoria USB 64 GB' THEN '/media/productos/memoria-usb-64-gb.webp'
         WHEN 'Router de prueba' THEN '/media/productos/router-de-prueba.webp'
         WHEN 'Switch de red 8 puertos' THEN '/media/productos/switch-de-red-8-puertos.webp'
         WHEN 'Tarjeta de red' THEN '/media/productos/tarjeta-de-red.webp'
         WHEN 'Memoria RAM 16 GB' THEN '/media/productos/memoria-ram-16-gb.webp'
         WHEN 'Fuente de poder 650 W' THEN '/media/productos/fuente-de-poder-650-w.webp'
         WHEN 'Ventilador 120 mm' THEN '/media/productos/ventilador-120-mm.webp'
         WHEN 'Audífonos' THEN '/media/productos/audifonos.webp'
         WHEN 'Micrófono USB' THEN '/media/productos/microfono-usb.webp'
         WHEN 'Bocina compacta' THEN '/media/productos/bocina-compacta.webp'
         ELSE NULL
       END AS imagen_propuesta
FROM producto
WHERE imagen_url IS NULL
ORDER BY nombre;

-- Una vez comprobada la previsualización, ejecutar esta actualización:
UPDATE producto
SET imagen_url = CASE nombre
  WHEN 'Teclado mecánico' THEN '/media/productos/teclado-mecanico.webp'
  WHEN 'Monitor de prueba 24″' THEN '/media/productos/monitor-de-prueba-24.webp'
  WHEN 'Cable HDMI' THEN '/media/productos/cable-hdmi.webp'
  WHEN 'Teclado compacto' THEN '/media/productos/teclado-compacto.webp'
  WHEN 'Mouse óptico' THEN '/media/productos/mouse-optico.webp'
  WHEN 'Monitor curvo 27″' THEN '/media/productos/monitor-curvo-27.webp'
  WHEN 'Monitor portátil 15″' THEN '/media/productos/monitor-portatil-15.webp'
  WHEN 'Cable DisplayPort' THEN '/media/productos/cable-displayport.webp'
  WHEN 'Hub USB-C' THEN '/media/productos/hub-usb-c.webp'
  WHEN 'SSD NVMe 1 TB' THEN '/media/productos/ssd-nvme-1-tb.webp'
  WHEN 'Disco externo 2 TB' THEN '/media/productos/disco-externo-2-tb.webp'
  WHEN 'Memoria USB 64 GB' THEN '/media/productos/memoria-usb-64-gb.webp'
  WHEN 'Router de prueba' THEN '/media/productos/router-de-prueba.webp'
  WHEN 'Switch de red 8 puertos' THEN '/media/productos/switch-de-red-8-puertos.webp'
  WHEN 'Tarjeta de red' THEN '/media/productos/tarjeta-de-red.webp'
  WHEN 'Memoria RAM 16 GB' THEN '/media/productos/memoria-ram-16-gb.webp'
  WHEN 'Fuente de poder 650 W' THEN '/media/productos/fuente-de-poder-650-w.webp'
  WHEN 'Ventilador 120 mm' THEN '/media/productos/ventilador-120-mm.webp'
  WHEN 'Audífonos' THEN '/media/productos/audifonos.webp'
  WHEN 'Micrófono USB' THEN '/media/productos/microfono-usb.webp'
  WHEN 'Bocina compacta' THEN '/media/productos/bocina-compacta.webp'
  ELSE imagen_url
END
WHERE imagen_url IS NULL
  AND nombre IN (
    'Teclado mecánico','Monitor de prueba 24″','Cable HDMI',
    'Teclado compacto','Mouse óptico','Monitor curvo 27″',
    'Monitor portátil 15″','Cable DisplayPort','Hub USB-C',
    'SSD NVMe 1 TB','Disco externo 2 TB','Memoria USB 64 GB',
    'Router de prueba','Switch de red 8 puertos','Tarjeta de red',
    'Memoria RAM 16 GB','Fuente de poder 650 W','Ventilador 120 mm',
    'Audífonos','Micrófono USB','Bocina compacta'
  );

-- Verificación final
SELECT nombre, imagen_url
FROM producto
ORDER BY nombre;
