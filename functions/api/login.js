// POST /api/login
// La pareja manda su código. Si existe en la lista "couples",
// le damos la cookie de sesión.

import { makeSessionCookie, jsonResponse } from "../../lib/session.js";

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const code = String(data.code ?? "").trim().toLowerCase();
  if (!code) return jsonResponse({ error: "code_required" }, 400);

  const couple = await env.DB
    .prepare("SELECT invite_id FROM couples WHERE access_code = ?")
    .bind(code)
    .first();

  if (!couple) return jsonResponse({ error: "wrong_code" }, 401);

  try {
    const cookie = await makeSessionCookie(env, couple.invite_id);
    return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
  } catch (err) {
    // El código era correcto pero no se pudo crear la sesión.
    // Casi siempre es porque falta el secreto SESSION_SECRET en Cloudflare.
    console.error("login: no se pudo crear la sesión:", err.message);
    const code = String(err.message).includes("SESSION_SECRET") ? "missing_secret" : "session_error";
    return jsonResponse({ error: code }, 500);
  }
}
