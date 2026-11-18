// POST /api/guests — agrega uno o varios invitados a la boda.
// Cuerpo: { guests: [ { line, name, passes, phone_last4 }, ... ] }
// Los que están bien se guardan; de los demás se devuelve el motivo (con su "line"
// para que la pantalla pueda decir cuál línea falló).

import { jsonResponse } from "../../../lib/session.js";
import { resolveInvite } from "../../../lib/auth.js";
import {
  cleanGuest,
  findDuplicate,
  listGuests,
  MAX_GUESTS_PER_WEDDING,
  MAX_PER_REQUEST,
} from "../../../lib/guests.js";

const CHUNK = 50;

export async function onRequestPost({ request, env }) {
  const { error, couple } = await resolveInvite(request, env, { write: true });
  if (error) return error;

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const incoming = Array.isArray(data.guests) ? data.guests : [];
  if (incoming.length === 0) return jsonResponse({ error: "no_guests" }, 400);
  if (incoming.length > MAX_PER_REQUEST) return jsonResponse({ error: "too_many" }, 400);

  const existing = await listGuests(env, couple.invite_id);
  const known = [...existing];
  const toInsert = [];
  const failed = [];

  incoming.forEach((raw, index) => {
    const line = Number.isInteger(raw?.line) ? raw.line : index + 1;
    const { guest, error: reason } = cleanGuest(raw);
    if (reason) {
      failed.push({ line, name: String(raw?.name ?? ""), error: reason });
      return;
    }
    if (findDuplicate(known, guest.name)) {
      failed.push({ line, name: guest.name, error: "duplicate_name" });
      return;
    }
    if (existing.length + toInsert.length >= MAX_GUESTS_PER_WEDDING) {
      failed.push({ line, name: guest.name, error: "guest_limit" });
      return;
    }
    known.push({ id: null, name: guest.name });
    toInsert.push(guest);
  });

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await env.DB.batch(
      toInsert.slice(i, i + CHUNK).map((g) =>
        env.DB
          .prepare("INSERT INTO guests (invite_id, name, passes, phone_last4) VALUES (?, ?, ?, ?)")
          .bind(couple.invite_id, g.name, g.passes, g.phone_last4)
      )
    );
  }

  return jsonResponse({ added: toInsert.length, failed }, toInsert.length > 0 ? 201 : 200);
}
