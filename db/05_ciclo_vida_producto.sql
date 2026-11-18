SET client_encoding TO 'UTF8';

ALTER TABLE producto ADD COLUMN IF NOT EXISTS estado varchar(10) NOT NULL DEFAULT 'activo';
ALTER TABLE producto DROP CONSTRAINT IF EXISTS producto_estado_check;
ALTER TABLE producto ADD CONSTRAINT producto_estado_check CHECK (estado IN ('activo', 'archivado'));
ALTER TABLE producto ADD COLUMN IF NOT EXISTS archivado_en timestamptz;

CREATE INDEX IF NOT EXISTS idx_producto_estado ON producto (estado);
