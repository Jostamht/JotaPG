// ------------------------------------------------------------
// Límite de intentos al entrar (/login).
// Después de MAX_FAILS códigos equivocados desde la misma conexión, el acceso desde esa
// conexión se pausa LOCK_SECONDS. Mientras dura la pausa se rechaza todo (aunque el código
// sea el correcto) y la pausa no se alarga. Una entrada correcta borra el conteo.
// Los intentos fallidos se cuentan dentro de una ventana de WINDOW_SECONDS: si pasa más tiempo
// sin fallar, se empieza de cero.
// Se guarda una huella de la dirección, no la dirección. Si la tabla login_attempts todavía
// no existe (migración 006) o el pedido no trae dirección, no se limita nada y el sitio
// sigue funcionando igual.
// ------------------------------------------------------------

export const MAX_FAILS = 10;
export const LOCK_SECONDS = 15 * 60;
export const WINDOW_SECONDS = 15 * 60;
const KEEP_SECONDS = 24 * 60 * 60; // las filas viejas se borran

const now = () => Math.floor(Date.now() / 1000);

// Huella de la dirección: nadie puede leer la dirección de vuelta desde la base de datos.
export async function attemptKey(ip) {
  const text = String(ip ?? "").trim();
  if (!text) return null;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("jotapg-login:" + text));
  return [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getRow(env, key) {
  return env.DB
    .prepare("SELECT fails, last_fail, locked_until FROM login_attempts WHERE key = ?")
    .bind(key)
    .first();
}

// ¿Está pausado el acceso desde esta conexión ahora mismo?
export async function isLoginBlocked(env, key) {
  if (!key) return false;
  try {
    const row = await getRow(env, key);
    return !!(row && row.locked_until && row.locked_until > now());
  } catch {
    return false;
  }
}

// Anota un código equivocado. Devuelve true si con este intento queda pausado.
export async function recordLoginFail(env, key) {
  if (!key) return false;
  try {
    const t = now();
    const row = await getRow(env, key);
    const lockOver = row && row.locked_until && row.locked_until <= t;
    const windowOver = row && row.last_fail < t - WINDOW_SECONDS;
    const fails = (row && !lockOver && !windowOver ? row.fails : 0) + 1;
    const lockedUntil = fails >= MAX_FAILS ? t + LOCK_SECONDS : null;
    await env.DB
      .prepare(
        `INSERT INTO login_attempts (key, fails, last_fail, locked_until) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET fails = excluded.fails, last_fail = excluded.last_fail, locked_until = excluded.locked_until`
      )
      .bind(key, fails, t, lockedUntil)
      .run();
    // De paso, se limpian las filas de hace más de un día para que la tabla no crezca.
    await env.DB.prepare("DELETE FROM login_attempts WHERE last_fail < ?").bind(t - KEEP_SECONDS).run();
    return lockedUntil !== null;
  } catch {
    return false;
  }
}

// Una entrada correcta borra el conteo de esa conexión.
export async function clearLoginFails(env, key) {
  if (!key) return;
  try {
    await env.DB.prepare("DELETE FROM login_attempts WHERE key = ?").bind(key).run();
  } catch {
    /* tabla todavía no creada */
  }
}
