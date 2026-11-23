SET client_encoding TO 'UTF8';

ALTER TABLE producto ADD COLUMN IF NOT EXISTS imagen_url varchar(300);

UPDATE producto SET imagen_url = '/media/productos/teclado-mecanico.webp'
    WHERE nombre = 'Teclado mecánico'
      AND (imagen_url IS NULL OR imagen_url = '/productos/teclado-mecanico.webp');
UPDATE producto SET imagen_url = '/media/productos/monitor-de-prueba-24.webp'
    WHERE nombre = 'Monitor de prueba 24″'
      AND (imagen_url IS NULL OR imagen_url = '/productos/monitor-de-prueba-24.webp');
UPDATE producto SET imagen_url = '/media/productos/cable-hdmi.webp'
    WHERE nombre = 'Cable HDMI'
      AND (imagen_url IS NULL OR imagen_url = '/productos/cable-hdmi.webp');
UPDATE producto SET imagen_url = '/media/productos/audifonos.webp'
    WHERE nombre = 'Audífonos'
      AND (imagen_url IS NULL OR imagen_url = '/productos/audifonos.webp');
UPDATE producto SET imagen_url = '/media/productos/bocina-compacta.webp'
    WHERE nombre = 'Bocina compacta'
      AND (imagen_url IS NULL OR imagen_url = '/productos/bocina-compacta.webp');
UPDATE producto SET imagen_url = '/media/productos/cable-displayport.webp'
    WHERE nombre = 'Cable DisplayPort'
      AND (imagen_url IS NULL OR imagen_url = '/productos/cable-displayport.webp');
UPDATE producto SET imagen_url = '/media/productos/disco-externo-2-tb.webp'
    WHERE nombre = 'Disco externo 2 TB'
      AND (imagen_url IS NULL OR imagen_url = '/productos/disco-externo-2-tb.webp');
UPDATE producto SET imagen_url = '/media/productos/fuente-de-poder-650-w.webp'
    WHERE nombre = 'Fuente de poder 650 W'
      AND (imagen_url IS NULL OR imagen_url = '/productos/fuente-de-poder-650-w.webp');
UPDATE producto SET imagen_url = '/media/productos/hub-usb-c.webp'
    WHERE nombre = 'Hub USB-C'
      AND (imagen_url IS NULL OR imagen_url = '/productos/hub-usb-c.webp');
UPDATE producto SET imagen_url = '/media/productos/memoria-ram-16-gb.webp'
    WHERE nombre = 'Memoria RAM 16 GB'
      AND (imagen_url IS NULL OR imagen_url = '/productos/memoria-ram-16-gb.webp');
UPDATE producto SET imagen_url = '/media/productos/memoria-usb-64-gb.webp'
    WHERE nombre = 'Memoria USB 64 GB'
      AND (imagen_url IS NULL OR imagen_url = '/productos/memoria-usb-64-gb.webp');
UPDATE producto SET imagen_url = '/media/productos/microfono-usb.webp'
    WHERE nombre = 'Micrófono USB'
      AND (imagen_url IS NULL OR imagen_url = '/productos/microfono-usb.webp');
UPDATE producto SET imagen_url = '/media/productos/monitor-curvo-27.webp'
    WHERE nombre = 'Monitor curvo 27″'
      AND (imagen_url IS NULL OR imagen_url = '/productos/monitor-curvo-27.webp');
UPDATE producto SET imagen_url = '/media/productos/monitor-portatil-15.webp'
    WHERE nombre = 'Monitor portátil 15″'
      AND (imagen_url IS NULL OR imagen_url = '/productos/monitor-portatil-15.webp');
UPDATE producto SET imagen_url = '/media/productos/mouse-optico.webp'
    WHERE nombre = 'Mouse óptico'
      AND (imagen_url IS NULL OR imagen_url = '/productos/mouse-optico.webp');
UPDATE producto SET imagen_url = '/media/productos/router-de-prueba.webp'
    WHERE nombre = 'Router de prueba'
      AND (imagen_url IS NULL OR imagen_url = '/productos/router-de-prueba.webp');
UPDATE producto SET imagen_url = '/media/productos/ssd-nvme-1-tb.webp'
    WHERE nombre = 'SSD NVMe 1 TB'
      AND (imagen_url IS NULL OR imagen_url = '/productos/ssd-nvme-1-tb.webp');
UPDATE producto SET imagen_url = '/media/productos/switch-de-red-8-puertos.webp'
    WHERE nombre = 'Switch de red 8 puertos'
      AND (imagen_url IS NULL OR imagen_url = '/productos/switch-de-red-8-puertos.webp');
UPDATE producto SET imagen_url = '/media/productos/tarjeta-de-red.webp'
    WHERE nombre = 'Tarjeta de red'
      AND (imagen_url IS NULL OR imagen_url = '/productos/tarjeta-de-red.webp');
UPDATE producto SET imagen_url = '/media/productos/teclado-compacto.webp'
    WHERE nombre = 'Teclado compacto'
      AND (imagen_url IS NULL OR imagen_url = '/productos/teclado-compacto.webp');
UPDATE producto SET imagen_url = '/media/productos/ventilador-120-mm.webp'
    WHERE nombre = 'Ventilador 120 mm'
      AND (imagen_url IS NULL OR imagen_url = '/productos/ventilador-120-mm.webp');

ALTER TABLE pedido ADD COLUMN IF NOT EXISTS inventario_descontado boolean NOT NULL DEFAULT false;

ALTER TABLE movimiento_inventario ADD COLUMN IF NOT EXISTS pedido_id uuid;

ALTER TABLE movimiento_inventario DROP CONSTRAINT IF EXISTS movimiento_inventario_pedido_fk;
ALTER TABLE movimiento_inventario ADD CONSTRAINT movimiento_inventario_pedido_fk
    FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimiento_inventario_pedido
    ON movimiento_inventario (pedido_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('12_imagenes_inventario_pedido.sql')
ON CONFLICT (archivo) DO NOTHING;
