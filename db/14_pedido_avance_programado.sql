SET client_encoding TO 'UTF8';

ALTER TABLE pedido ADD COLUMN IF NOT EXISTS avanza_en timestamptz;

CREATE INDEX IF NOT EXISTS idx_pedido_avanza_en
    ON pedido (avanza_en)
    WHERE avanza_en IS NOT NULL;

CREATE TABLE IF NOT EXISTS schema_migrations (
    archivo text PRIMARY KEY,
    aplicada timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (archivo) VALUES ('14_pedido_avance_programado.sql')
ON CONFLICT (archivo) DO NOTHING;
