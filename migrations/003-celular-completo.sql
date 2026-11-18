-- ============================================================
-- Migración 003: el invitado confirma con su celular COMPLETO
-- (antes eran solo los últimos 4 dígitos).
-- Se corre una sola vez, ANTES de publicar el código nuevo.
--
-- Cambia el nombre de la columna phone_last4 a phone y quita la regla de "exactamente 4 dígitos".
-- Los invitados que ya estaban cargados conservan lo que tenían (4 dígitos): el panel los marca
-- con "Falta el celular completo" hasta que los edites. Los dos de la muestra (Juan Pérez y
-- Ruth Gómez) se actualizan solos con números de ejemplo.
-- ============================================================

CREATE TABLE guests_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id   TEXT NOT NULL REFERENCES couples(invite_id),
  name        TEXT NOT NULL,
  passes      INTEGER NOT NULL DEFAULT 1 CHECK (passes BETWEEN 1 AND 10),
  phone       TEXT NOT NULL CHECK (length(phone) BETWEEN 4 AND 20),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (invite_id, name)
);

INSERT INTO guests_new (id, invite_id, name, passes, phone, created_at)
SELECT id, invite_id, name, passes, phone_last4, created_at FROM guests;

-- Las respuestas apuntan a los invitados. Se anotan y se sueltan un momento para poder
-- cambiar la tabla; después se vuelven a enlazar (los invitados conservan su mismo id).
CREATE TABLE rsvp_links AS SELECT id, guest_id FROM rsvps WHERE guest_id IS NOT NULL;
UPDATE rsvps SET guest_id = NULL WHERE guest_id IS NOT NULL;

DROP TABLE guests;
ALTER TABLE guests_new RENAME TO guests;
CREATE INDEX idx_guests_invite ON guests(invite_id);

UPDATE rsvps SET guest_id = (SELECT l.guest_id FROM rsvp_links l WHERE l.id = rsvps.id)
WHERE id IN (SELECT id FROM rsvp_links);
DROP TABLE rsvp_links;

UPDATE guests SET phone = '71234567' WHERE invite_id = 'muestra-3' AND name = 'Juan Pérez' AND phone = '1234';
UPDATE guests SET phone = '75678901' WHERE invite_id = 'muestra-3' AND name = 'Ruth Gómez' AND phone = '5678';
