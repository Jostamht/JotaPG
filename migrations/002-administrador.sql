-- ============================================================
-- Migración 002: clave del administrador.
-- Se corre una sola vez, DESPUÉS de la 001 y antes de publicar el código nuevo.
--
--   npx wrangler d1 execute jotapg-db --remote --file=migrations/002-administrador.sql
--
-- O pega el contenido en la consola de jotapg-db en Cloudflare.
--
-- Crea tu clave de administrador (al azar). Con ella entras en /login y llegas a /admin,
-- donde ves y manejas todas las bodas. Para verla:
--
--   SELECT value FROM settings WHERE key = 'admin_code';
--
-- Guárdala en un lugar seguro. Si prefieres una propia (mínimo 12 caracteres):
--
--   UPDATE settings SET value = 'tu-clave-larga-aqui' WHERE key = 'admin_code';
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value)
VALUES ('admin_code', lower(hex(randomblob(16))));
