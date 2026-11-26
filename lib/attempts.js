// ------------------------------------------------------------
// Bloqueo por celulares equivocados.
// Después de MAX_FAILS celulares equivocados para un mismo invitado, ese invitado queda
// bloqueado LOCK_SECONDS. Así nadie puede probar números uno tras otro.
// Si la tabla rsvp_attempts todavía no existe (migración 005), no se bloquea nada
// y el sitio sigue funcionando igual.
// ------------------------------------------------------------

export const MAX_FAILS = 5;
export const LOCK_SECONDS = 15 * 60;

const now = () => Math.floor(Date.now() / 1000);

async function getRow(env, inviteId, guestId) {
  return env.DB
    .prepare("SELECT fails, locked_until FROM rsvp_attempts WHERE invite_id = ? AND guest_id = ?")
    .bind(inviteId, guestId)
    .first();
}

// ¿Está bloqueado este invitado ahora mismo?
export async function isLocked(env, inviteId, guestId) {
  try {
    const row = await getRow(env, inviteId, guestId);
    return !!(row && row.locked_until && row.locked_until > now());
  } catch {
    return false;
  }
}

// Anota un celular equivocado. Devuelve true si con este intento queda bloqueado.
export async function recordFail(env, inviteId, guestId) {
  try {
    const row = await getRow(env, inviteId, guestId);
    const expired = row && row.locked_until && row.locked_until <= now();
    const fails = (row && !expired ? row.fails : 0) + 1;
    const lockedUntil = fails >= MAX_FAILS ? now() + LOCK_SECONDS : null;
    await env.DB
      .prepare(
        `INSERT INTO rsvp_attempts (invite_id, guest_id, fails, locked_until) VALUES (?, ?, ?, ?)
         ON CONFLICT(invite_id, guest_id) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until`
      )
      .bind(inviteId, guestId, fails, lockedUntil)
      .run();
    return lockedUntil !== null;
  } catch {
    return false;
  }
}

// Una confirmación correcta borra los intentos fallidos de ese invitado.
export async function clearFails(env, inviteId, guestId) {
  try {
    await env.DB
      .prepare("DELETE FROM rsvp_attempts WHERE invite_id = ? AND guest_id = ?")
      .bind(inviteId, guestId)
      .run();
  } catch {
    /* tabla todavía no creada */
  }
}

// Al borrar un invitado se borran también sus intentos fallidos (ya no hay a quién bloquear).
export async function forgetGuest(env, inviteId, guestId) {
  try {
    await env.DB
      .prepare("DELETE FROM rsvp_attempts WHERE invite_id = ? AND guest_id = ?")
      .bind(inviteId, guestId)
      .run();
  } catch {
    /* tabla todavía no creada */
  }
}

// Al borrar una boda se borran los intentos fallidos de todos sus invitados.
export async function forgetWedding(env, inviteId) {
  try {
    await env.DB.prepare("DELETE FROM rsvp_attempts WHERE invite_id = ?").bind(inviteId).run();
  } catch {
    /* tabla todavía no creada */
  }
}
