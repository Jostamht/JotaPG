-- ============================================================
-- Migración 004: fecha y hora de la boda (para la cuenta regresiva del panel).
-- Se corre una sola vez. Si todavía no la corriste, el sitio funciona igual; solo que
-- no se puede guardar la fecha hasta que lo hagas.
-- La fecha se escribe desde /admin (al crear o al editar una boda).
-- ============================================================

ALTER TABLE couples ADD COLUMN wedding_date TEXT;
