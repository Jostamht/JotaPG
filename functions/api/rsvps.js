// GET /api/rsvps
// Devuelve las respuestas de la pareja que inició sesión.
// Solo las de ella: el invite_id sale de la cookie, no de lo que mande el navegador.

import { getSession, jsonResponse } from "../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const inviteId = await getSession(request, env);
  if (!inviteId) return jsonResponse({ error: "not_logged_in" }, 401);

  const couple = await env.DB
    .prepare("SELECT names FROM couples WHERE invite_id = ?")
    .bind(inviteId)
    .first();
  if (!couple) return jsonResponse({ error: "not_logged_in" }, 401);

  const { results } = await env.DB
    .prepare(
      `SELECT id, guest_name, attending, guests_count, dietary, message, created_at
       FROM rsvps WHERE invite_id = ? ORDER BY id DESC`
    )
    .bind(inviteId)
    .all();

  return jsonResponse({ names: couple.names, rsvps: results });
}
