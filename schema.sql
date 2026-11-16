-- ============================================================
-- Base de datos de JotaPG (Cloudflare D1)
-- Dos listas: "couples" (las parejas) y "rsvps" (las respuestas).
-- ============================================================

-- Lista 1: las parejas
CREATE TABLE IF NOT EXISTS couples (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id      TEXT NOT NULL UNIQUE,   -- nombre corto de la invitación, ej. "juancarlos"
  names          TEXT NOT NULL,          -- ej. "Juan y Carla"
  allowed_origin TEXT NOT NULL,          -- dirección de su invitación, ej. "https://juancarlos.pages.dev"
  access_code    TEXT NOT NULL UNIQUE,   -- el código con el que entran a su panel
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lista 2: las respuestas de los invitados
CREATE TABLE IF NOT EXISTS rsvps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id    TEXT NOT NULL REFERENCES couples(invite_id),  -- a qué pareja pertenece
  guest_name   TEXT NOT NULL,
  attending    INTEGER NOT NULL CHECK (attending IN (0, 1)), -- 1 = viene, 0 = no viene
  guests_count INTEGER NOT NULL DEFAULT 1 CHECK (guests_count BETWEEN 0 AND 10),
  dietary      TEXT,                     -- restricciones de comida
  message      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rsvps_invite ON rsvps(invite_id);
