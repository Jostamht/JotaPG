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
    // Solo los NOMBRES de lo que el sitio puede ver (nunca los valores), para detectar errores de escritura.
    nombres_visibles: Object.keys(env).sort(),
    // Solo el tipo y el largo de SESSION_SECRET (nunca el valor), para saber si llega vacío.
    session_secret_tipo: typeof env.SESSION_SECRET,
    session_secret_largo: typeof env.SESSION_SECRET === "string" ? env.SESSION_SECRET.length : null,
  });
}
