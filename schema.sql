-- ============================================================
-- Base de datos de JotaPG (Cloudflare D1)
-- Tres listas: "couples" (las parejas), "guests" (los invitados de cada pareja)
-- y "rsvps" (las respuestas).
-- ============================================================

-- Lista 1: las parejas
CREATE TABLE IF NOT EXISTS couples (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id      TEXT NOT NULL UNIQUE,   -- nombre corto de la invitación, ej. "juancarlos"
  names          TEXT NOT NULL,          -- ej. "Juan y Carla"
  allowed_origin TEXT NOT NULL,          -- dirección de su invitación, ej. "https://juancarlos.pages.dev"
  access_code    TEXT NOT NULL UNIQUE,   -- el código con el que entran a su panel
  wedding_date   TEXT,                   -- fecha y hora de la boda, ej. "2026-12-12T16:00" (opcional)
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lista 2: los invitados de cada pareja (la lista que se cargó para la boda)
CREATE TABLE IF NOT EXISTS guests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id   TEXT NOT NULL REFERENCES couples(invite_id),  -- a qué pareja pertenece
  name        TEXT NOT NULL,                                -- como aparece en su invitación
  passes      INTEGER NOT NULL DEFAULT 1 CHECK (passes BETWEEN 1 AND 10),  -- pases disponibles
  phone       TEXT NOT NULL CHECK (length(phone) BETWEEN 4 AND 20),        -- celular completo, solo dígitos
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (invite_id, name)
);

CREATE INDEX IF NOT EXISTS idx_guests_invite ON guests(invite_id);

-- Lista 3: las respuestas de los invitados
CREATE TABLE IF NOT EXISTS rsvps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id    TEXT NOT NULL REFERENCES couples(invite_id),  -- a qué pareja pertenece
  guest_id     INTEGER REFERENCES guests(id),                -- qué invitado respondió
  guest_name   TEXT NOT NULL,
  attending    INTEGER NOT NULL CHECK (attending IN (0, 1)), -- 1 = viene, 0 = no viene
  guests_count INTEGER NOT NULL DEFAULT 1 CHECK (guests_count BETWEEN 0 AND 10),
  dietary      TEXT,                     -- restricciones de comida
  message      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rsvps_invite ON rsvps(invite_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_guest ON rsvps(guest_id);

-- Ajustes privados del sitio (por ejemplo, el secreto con el que se firman las sesiones)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tu clave de administrador (al azar). Para verla:
--   SELECT value FROM settings WHERE key = 'admin_code';
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_code', lower(hex(randomblob(16))));

-- Bloqueo por celulares equivocados (anti-spam): ver lib/attempts.js
CREATE TABLE IF NOT EXISTS rsvp_attempts (
  invite_id    TEXT NOT NULL,
  guest_id     INTEGER NOT NULL,
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  PRIMARY KEY (invite_id, guest_id)
);

-- Límite de intentos al entrar (/login): ver lib/login-attempts.js
CREATE TABLE IF NOT EXISTS login_attempts (
  key          TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  last_fail    INTEGER NOT NULL,
  locked_until INTEGER
);
