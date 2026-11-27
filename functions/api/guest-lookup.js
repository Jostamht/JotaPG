// POST /api/guest-lookup — la invitación pregunta "¿quién es este invitado?".
// Responde solo el nombre tal como está en la lista y sus pases. Nunca devuelve
// la lista completa ni el celular: el celular se revisa al confirmar (/api/rsvp).
//
// Dos formas de preguntar, según cómo confirme la boda (rsvp_mode en couples):
//   { invite_id, name }  — por nombre (bodas "typed" y "both"). En una boda "link" no busca nada.
//   { invite_id, code }  — por el código del link personal (bodas "link" y "both").
// Toda respuesta trae también `mode`, para que la invitación sepa qué mostrar.

import {
  handleOptions,
  json,
  getCoupleForOrigin,
  getGuests,
  getGuestByCode,
  findGuest,
} from "../../lib/invite-api.js";

export const onRequestOptions = handleOptions;

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin) return json({ error: "origin_required" }, 400);

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }

  const inviteId = String(data.invite_id ?? "").trim();
  const couple = await getCoupleForOrigin(env, inviteId, origin);
  if (!couple) return json({ error: "forbidden" }, 403);

  const mode = couple.rsvp_mode;
  const notFound = (ambiguous = false) => json({ found: false, ambiguous, mode }, 200, origin);

  // Por el link personal.
  const code = String(data.code ?? "").trim();
  if (code) {
    if (mode === "typed") return notFound();
    const guest = await getGuestByCode(env, inviteId, code);
    if (!guest) return notFound();
    return json({ found: true, name: guest.name, passes: guest.passes, mode }, 200, origin);
  }

  // Por nombre. En una boda de link personal no se busca por nombre (así nadie puede probar nombres).
  if (mode === "link") return notFound();

  const query = String(data.name ?? "");
  if (query.length > 100) return notFound();

  const { guest, ambiguous } = findGuest(await getGuests(env, inviteId, false), query);
  if (!guest) return notFound(ambiguous);

  return json({ found: true, name: guest.name, passes: guest.passes, mode }, 200, origin);
}
