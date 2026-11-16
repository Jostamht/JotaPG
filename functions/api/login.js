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

  const cookie = await makeSessionCookie(env, couple.invite_id);
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
}
