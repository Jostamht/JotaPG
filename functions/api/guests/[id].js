// PUT    /api/guests/:id — corrige el nombre, los pases o el celular de un invitado.
// DELETE /api/guests/:id — borra al invitado (y su respuesta, si ya había confirmado).
// Siempre se busca dentro de la boda de quien pide: nadie puede tocar invitados de otra.

import { jsonResponse } from "../../../lib/session.js";
import { resolveInvite } from "../../../lib/auth.js";
import { cleanGuest, findDuplicate, listGuests } from "../../../lib/guests.js";

function guestId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestPut({ request, env, params }) {
  const { error, couple } = await resolveInvite(request, env, { write: true });
  if (error) return error;

  const id = guestId(params);
  if (!id) return jsonResponse({ error: "guest_not_found" }, 404);

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const { guest, error: reason } = cleanGuest(data);
  if (reason) return jsonResponse({ error: reason }, 400);

  const current = await env.DB
    .prepare("SELECT id FROM guests WHERE id = ? AND invite_id = ?")
    .bind(id, couple.invite_id)
    .first();
  if (!current) return jsonResponse({ error: "guest_not_found" }, 404);

  if (findDuplicate(await listGuests(env, couple.invite_id), guest.name, id)) {
    return jsonResponse({ error: "duplicate_name" }, 409);
  }

  // No se puede bajar los pases por debajo de lo que el invitado ya confirmó.
  const rsvp = await env.DB
    .prepare("SELECT attending, guests_count FROM rsvps WHERE guest_id = ?")
    .bind(id)
    .first();
  if (rsvp && rsvp.attending === 1 && rsvp.guests_count > guest.passes) {
    return jsonResponse({ error: "passes_below_confirmed", confirmed: rsvp.guests_count }, 409);
  }

  await env.DB.batch([
    env.DB
      .prepare("UPDATE guests SET name = ?, passes = ?, phone_last4 = ? WHERE id = ? AND invite_id = ?")
      .bind(guest.name, guest.passes, guest.phone_last4, id, couple.invite_id),
    // La respuesta guarda también el nombre; se mantiene al día.
    env.DB.prepare("UPDATE rsvps SET guest_name = ? WHERE guest_id = ?").bind(guest.name, id),
  ]);

  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error, couple } = await resolveInvite(request, env, { write: true });
  if (error) return error;

  const id = guestId(params);
  if (!id) return jsonResponse({ error: "guest_not_found" }, 404);

  const current = await env.DB
    .prepare("SELECT id FROM guests WHERE id = ? AND invite_id = ?")
    .bind(id, couple.invite_id)
    .first();
  if (!current) return jsonResponse({ error: "guest_not_found" }, 404);

  // Primero su respuesta (depende del invitado), luego el invitado.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rsvps WHERE guest_id = ?").bind(id),
    env.DB.prepare("DELETE FROM guests WHERE id = ? AND invite_id = ?").bind(id, couple.invite_id),
  ]);

  return jsonResponse({ ok: true });
}
