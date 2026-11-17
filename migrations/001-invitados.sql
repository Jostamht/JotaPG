-- ============================================================
-- Migración 001: lista de invitados en la base de datos.
-- Para la base de datos que YA existe (jotapg-db). Se corre una sola vez,
-- ANTES de publicar el código nuevo. No rompe el código actual.
--
--   npx wrangler d1 execute jotapg-db --remote --file=migrations/001-invitados.sql
--
-- O pega el contenido en la consola de jotapg-db en Cloudflare.
-- ============================================================

CREATE TABLE IF NOT EXISTS guests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id   TEXT NOT NULL REFERENCES couples(invite_id),
  name        TEXT NOT NULL,
  passes      INTEGER NOT NULL DEFAULT 1 CHECK (passes BETWEEN 1 AND 10),
  phone_last4 TEXT NOT NULL CHECK (length(phone_last4) = 4),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (invite_id, name)
);

CREATE INDEX IF NOT EXISTS idx_guests_invite ON guests(invite_id);

-- Las respuestas ahora apuntan al invitado que las envió.
ALTER TABLE rsvps ADD COLUMN guest_id INTEGER REFERENCES guests(id);
CREATE INDEX IF NOT EXISTS idx_rsvps_guest ON rsvps(guest_id);

-- Invitados de la muestra (los mismos que estaban en invite.js).
INSERT OR IGNORE INTO guests (invite_id, name, passes, phone_last4) VALUES
  ('muestra-3', 'Juan Pérez', 2, '1234'),
  ('muestra-3', 'Ruth Gómez', 3, '5678');

-- Si Juan o Ruth ya habían confirmado antes, enlazamos esa respuesta con su ficha.
UPDATE rsvps
SET guest_id = (
  SELECT g.id FROM guests g
  WHERE g.invite_id = rsvps.invite_id AND g.name = rsvps.guest_name
)
WHERE guest_id IS NULL;
