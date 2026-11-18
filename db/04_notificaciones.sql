SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS notificacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    tipo varchar(40) NOT NULL,
    titulo varchar(160) NOT NULL,
    mensaje text NOT NULL,
    datos jsonb NOT NULL DEFAULT '{}'::jsonb,
    clave_dedupe varchar(160),
    leida boolean NOT NULL DEFAULT false,
    creada timestamptz NOT NULL DEFAULT now(),
    leida_en timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notificacion_user ON notificacion (user_id, creada DESC);
CREATE INDEX IF NOT EXISTS idx_notificacion_no_leida ON notificacion (user_id) WHERE leida = false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacion_dedupe
    ON notificacion (user_id, clave_dedupe) WHERE clave_dedupe IS NOT NULL AND leida = false;
