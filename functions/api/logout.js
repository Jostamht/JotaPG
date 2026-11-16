// POST /api/logout
// Borra la cookie de sesión.

import { clearSessionCookie, jsonResponse } from "../../lib/session.js";

export async function onRequestPost() {
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
