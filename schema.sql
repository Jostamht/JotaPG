-- ============================================================
-- Base de datos de JotaPG (Cloudflare D1)
-- Tres listas principales: "couples" (las parejas), "guests" (los invitados de cada pareja)
-- y "rsvps" (las respuestas), más dos para el anti-spam: "rsvp_attempts" y "login_attempts".
-- Los secretos (SESSION_SECRET, ADMIN_CODE, TURNSTILE_SECRET) NO viven aquí: están solo en Cloudflare.
-- ============================================================

-- Lista 1: las parejas
CREATE TABLE IF NOT EXISTS couples (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id      TEXT NOT NULL UNIQUE,   -- nombre corto de la invitación, ej. "juancarlos"
  names          TEXT NOT NULL,          -- ej. "Juan y Carla"
  allowed_origin TEXT NOT NULL,          -- dirección de su invitación, ej. "https://juancarlos.pages.dev"
  access_code    TEXT NOT NULL UNIQUE,   -- el código con el que entran a su panel
  wedding_date   TEXT,                   -- fecha y hora de la boda, ej. "2026-12-12T16:00" (opcional)
  rsvp_mode      TEXT NOT NULL DEFAULT 'typed' CHECK (rsvp_mode IN ('typed', 'link', 'both')),
                                         -- cómo confirman: typed = escriben nombre y celular, link = link personal, both = las dos (solo para la muestra)
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lista 2: los invitados de cada pareja (la lista que se cargó para la boda)
CREATE TABLE IF NOT EXISTS guests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id   TEXT NOT NULL REFERENCES couples(invite_id),  -- a qué pareja pertenece
  name        TEXT NOT NULL,                                -- como aparece en su invitación
  passes      INTEGER NOT NULL DEFAULT 1 CHECK (passes BETWEEN 1 AND 10),  -- pases disponibles
  phone       TEXT NOT NULL CHECK (length(phone) BETWEEN 4 AND 20),        -- celular completo, solo dígitos
  guest_code  TEXT,                                             -- código privado para su link personal (16 letras/números al azar)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (invite_id, name)
);

CREATE INDEX IF NOT EXISTS idx_guests_invite ON guests(invite_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_code ON guests(guest_code);

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
