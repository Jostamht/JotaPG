// GET /api/admin/secrets — dice de dónde sale cada secreto: "cloudflare", "base_de_datos" o "falta".
// Solo para el administrador. Nunca devuelve los valores, solo su origen.
// Sirve para comprobar que los secretos de Cloudflare funcionan antes de borrar las copias
// de la base de datos. Cuando ya no haga falta, se puede borrar este archivo.

import { jsonResponse, getSetting } from "../../../lib/session.js";
import { requireAdmin } from "../../../lib/auth.js";

async function origen(envValue, env, key) {
  if (envValue) return "cloudflare";
  return (await getSetting(env, key)) ? "base_de_datos" : "falta";
}

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  return jsonResponse({
    session_secret: await origen(env.SESSION_SECRET, env, "session_secret"),
    admin_code: await origen(env.ADMIN_CODE, env, "admin_code"),
  });
}
