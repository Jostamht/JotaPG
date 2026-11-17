// ------------------------------------------------------------
// Lo que comparten los pedidos que vienen desde las invitaciones
// (/api/rsvp y /api/guest-lookup): permisos del navegador (CORS),
// revisión de la pareja y búsqueda del invitado por nombre.
// ------------------------------------------------------------

export function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
    },
  });
}

// Preflight: el navegador pregunta si el origen tiene permiso (aún no hay body).
export async function handleOptions({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin) return new Response(null, { status: 204 });

  const row = await env.DB
    .prepare("SELECT 1 FROM couples WHERE allowed_origin = ? LIMIT 1")
    .bind(origin)
    .first();

  if (!row) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

// Devuelve la pareja si la invitación existe y el pedido viene de su dirección.
// Misma respuesta (null) si no existe o si el origen no coincide.
export async function getCoupleForOrigin(env, inviteId, origin) {
  const couple = await env.DB
    .prepare("SELECT invite_id, allowed_origin FROM couples WHERE invite_id = ?")
    .bind(inviteId)
    .first();
  if (!couple || couple.allowed_origin !== origin) return null;
  return couple;
}

// Quita tildes, mayúsculas y espacios de más para comparar nombres.
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Busca al invitado por el nombre que escribió (nombre y apellido, sin importar tildes).
// - Si escribió el nombre completo, gana la coincidencia exacta.
// - Si todas las palabras están en un solo invitado, es ese.
// - Si calzan varios, es ambiguo: se le pide escribirlo completo.
export function findGuest(guests, query) {
  const text = normalize(query);
  const words = text.split(" ").filter(Boolean);
  if (words.length < 2) return { guest: null, ambiguous: false };

  const exact = guests.filter((g) => normalize(g.name) === text);
  if (exact.length === 1) return { guest: exact[0], ambiguous: false };

  const partial = guests.filter((g) => {
    const name = normalize(g.name);
    return words.every((w) => name.includes(w));
  });
  if (partial.length === 1) return { guest: partial[0], ambiguous: false };
  return { guest: null, ambiguous: partial.length > 1 };
}

export async function getGuests(env, inviteId) {
  const { results } = await env.DB
    .prepare("SELECT id, name, passes, phone_last4 FROM guests WHERE invite_id = ?")
    .bind(inviteId)
    .all();
  return results;
}
