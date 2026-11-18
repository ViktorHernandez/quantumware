SET client_encoding TO 'UTF8';

ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS correo_estado varchar(20);

ALTER TABLE notificacion DROP CONSTRAINT IF EXISTS notificacion_correo_estado_check;
ALTER TABLE notificacion ADD CONSTRAINT notificacion_correo_estado_check
    CHECK (correo_estado IS NULL OR correo_estado IN ('encolado', 'sin_destinatario'));

CREATE INDEX IF NOT EXISTS idx_notificacion_correo_estado
    ON notificacion (correo_estado)
    WHERE correo_estado = 'sin_destinatario';

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('13_notificacion_correo_estado.sql')
ON CONFLICT (archivo) DO NOTHING;
