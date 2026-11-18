SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS correo_salida (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notificacion_id uuid REFERENCES notificacion (id) ON DELETE SET NULL,
    destinatario varchar(255) NOT NULL,
    asunto varchar(255) NOT NULL,
    html text NOT NULL,
    texto text,
    clave_dedupe varchar(160),
    estado varchar(10) NOT NULL DEFAULT 'pendiente',
    intentos int NOT NULL DEFAULT 0,
    max_intentos int NOT NULL DEFAULT 5,
    proximo_intento timestamptz NOT NULL DEFAULT now(),
    ultimo_error text,
    creado_en timestamptz NOT NULL DEFAULT now(),
    enviado_en timestamptz
);

ALTER TABLE correo_salida DROP CONSTRAINT IF EXISTS correo_salida_estado_check;
ALTER TABLE correo_salida ADD CONSTRAINT correo_salida_estado_check
    CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'fallido'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_correo_salida_dedupe
    ON correo_salida (clave_dedupe) WHERE clave_dedupe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_correo_salida_pendientes
    ON correo_salida (proximo_intento) WHERE estado = 'pendiente';

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('10_correo_salida.sql')
ON CONFLICT (archivo) DO NOTHING;
