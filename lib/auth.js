// ------------------------------------------------------------
// Quién está pidiendo algo y de qué boda se trata.
//
// - Una pareja solo puede tocar SU boda: el invite_id sale de su cookie,
//   nunca de lo que mande el navegador.
// - El administrador puede tocar cualquier boda: indica cuál con ?c=invite_id.
//
// Las funciones devuelven { error: Response } si algo no cuadra, para que
// quien las llame solo tenga que devolver esa respuesta.
// ------------------------------------------------------------

import { getAuth, jsonResponse } from "./session.js";

// Los pedidos que cambian datos deben venir de este mismo sitio (protege contra
// formularios de otras páginas). Si el pedido no trae "Origin" no viene de un
// navegador, y sin la cookie de sesión no llegaría hasta aquí.
export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function blocked(write, request) {
  return write && !isSameOrigin(request) ? jsonResponse({ error: "forbidden" }, 403) : null;
}

// Para las pantallas de una boda (panel, invitados).
export async function resolveInvite(request, env, { write = false } = {}) {
  const bad = blocked(write, request);
  if (bad) return { error: bad };

  const auth = await getAuth(request, env);
  if (!auth) return { error: jsonResponse({ error: "not_logged_in" }, 401) };

  let inviteId = auth.inviteId;
  if (auth.role === "admin") {
    inviteId = new URL(request.url).searchParams.get("c") || "";
    if (!inviteId) return { error: jsonResponse({ error: "invite_required" }, 400) };
  }

  const couple = await env.DB
    .prepare("SELECT invite_id, names, allowed_origin FROM couples WHERE invite_id = ?")
    .bind(inviteId)
    .first();
  if (!couple) {
    return auth.role === "admin"
      ? { error: jsonResponse({ error: "couple_not_found" }, 404) }
      : { error: jsonResponse({ error: "not_logged_in" }, 401) };
  }
  return { auth, couple };
}

// Para las pantallas del administrador.
export async function requireAdmin(request, env, { write = false } = {}) {
  const bad = blocked(write, request);
  if (bad) return { error: bad };

  const auth = await getAuth(request, env);
  if (!auth) return { error: jsonResponse({ error: "not_logged_in" }, 401) };
  if (auth.role !== "admin") return { error: jsonResponse({ error: "forbidden" }, 403) };
  return { auth };
}
