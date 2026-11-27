-- ============================================================
-- Migración 007: invitaciones con link personal.
-- Se corre una sola vez. Si todavía no la corriste, el sitio funciona igual que antes
-- (todas las bodas siguen como hasta ahora); solo que no se puede elegir el modo de una boda
-- ni usar links personales hasta que lo hagas.
--
-- 1) Cada boda tiene un modo de confirmación (couples.rsvp_mode):
--      typed = el invitado escribe su nombre y su celular (como hasta ahora; es el valor de todas las bodas que ya existen)
--      link  = cada invitado entra con su link personal y no escribe nada
--      both  = acepta las dos formas (pensado solo para la invitación de muestra)
-- 2) Cada invitado tiene un código privado (guests.guest_code, 16 letras/números al azar) que va en su link.
--    A los invitados que ya existen se les crea el código aquí mismo.
-- ============================================================

ALTER TABLE couples ADD COLUMN rsvp_mode TEXT NOT NULL DEFAULT 'typed' CHECK (rsvp_mode IN ('typed', 'link', 'both'));

ALTER TABLE guests ADD COLUMN guest_code TEXT;

UPDATE guests SET guest_code = lower(hex(randomblob(8))) WHERE guest_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_code ON guests(guest_code);
