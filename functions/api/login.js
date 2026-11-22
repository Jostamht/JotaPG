// POST /api/login
// Entran con un código. Puede ser el de una pareja (lista "couples") o el del
// administrador (ajuste "admin_code"). Si existe, damos la cookie de sesión.

import { makeSessionCookie, jsonResponse, getAdminCode, safeEqual } from "../../lib/session.js";
import { attemptKey, isLoginBlocked, recordLoginFail, clearLoginFails } from "../../lib/login-attempts.js";

const MIN_ADMIN_CODE = 12;

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const code = String(data.code ?? "").trim().toLowerCase();
  if (!code) return jsonResponse({ error: "code_required" }, 400);

  // Límite de intentos: tras varios códigos equivocados desde la misma conexión, se pausa
  // (se revisa ANTES de mirar el código, así probar más códigos no sirve de nada).
  const key = await attemptKey(request.headers.get("CF-Connecting-IP"));
  if (await isLoginBlocked(env, key)) return jsonResponse({ error: "too_many_attempts" }, 429);

  // ¿Es el código del administrador?
  const adminCode = await getAdminCode(env);
  const isAdmin = adminCode.length >= MIN_ADMIN_CODE && (await safeEqual(code, adminCode));

  let inviteId = null;
  if (!isAdmin) {
    const couple = await env.DB
      .prepare("SELECT invite_id FROM couples WHERE access_code = ?")
      .bind(code)
      .first();
    if (!couple) {
      const nowBlocked = await recordLoginFail(env, key);
      return nowBlocked
        ? jsonResponse({ error: "too_many_attempts" }, 429)
        : jsonResponse({ error: "wrong_code" }, 401);
    }
    inviteId = couple.invite_id;
  }
  await clearLoginFails(env, key);

  try {
    const cookie = isAdmin
      ? await makeSessionCookie(env, null, "admin", adminCode)
      : await makeSessionCookie(env, inviteId, "couple", code);
    return jsonResponse({ ok: true, role: isAdmin ? "admin" : "couple" }, 200, { "Set-Cookie": cookie });
  } catch (err) {
    // El código era correcto pero no se pudo crear la sesión.
    // Casi siempre es porque falta el secreto SESSION_SECRET en Cloudflare.
    console.error("login: no se pudo crear la sesión:", err.message);
    const reason = String(err.message).includes("SESSION_SECRET") ? "missing_secret" : "session_error";
    return jsonResponse({ error: reason }, 500);
  }
}
