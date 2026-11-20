-- ============================================================
-- Migración 005: bloqueo por celulares equivocados (anti-spam).
-- Se corre una sola vez. Si todavía no la corriste, el sitio funciona igual; solo que
-- no hay bloqueo hasta que lo hagas.
-- Tras 5 celulares equivocados para un mismo invitado, queda bloqueado 15 minutos.
-- ============================================================

CREATE TABLE IF NOT EXISTS rsvp_attempts (
  invite_id    TEXT NOT NULL,
  guest_id     INTEGER NOT NULL,
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  PRIMARY KEY (invite_id, guest_id)
);
