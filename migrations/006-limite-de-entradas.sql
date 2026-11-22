-- ============================================================
-- Migración 006: límite de intentos al entrar (/login).
-- Se corre una sola vez. Si todavía no la corriste, el sitio funciona igual; solo que
-- no hay límite hasta que lo hagas.
-- Tras 10 códigos equivocados desde la misma conexión, el acceso se pausa 15 minutos.
-- Se guarda una huella de la dirección (no la dirección misma).
-- ============================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  key          TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  last_fail    INTEGER NOT NULL,
  locked_until INTEGER
);
