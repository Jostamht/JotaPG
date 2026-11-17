// POST /api/guest-lookup — la invitación pregunta "¿quién es este invitado?".
// Responde solo el nombre tal como está en la lista y sus pases. Nunca devuelve
// la lista completa ni el celular: el celular se revisa al confirmar (/api/rsvp).

import {
  handleOptions,
  json,
  getCoupleForOrigin,
  getGuests,
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

  const query = String(data.name ?? "");
  if (query.length > 100) return json({ found: false, ambiguous: false }, 200, origin);

  const { guest, ambiguous } = findGuest(await getGuests(env, inviteId), query);
  if (!guest) return json({ found: false, ambiguous }, 200, origin);

  return json({ found: true, name: guest.name, passes: guest.passes }, 200, origin);
}
