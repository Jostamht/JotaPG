// GET /api/rsvps
// Devuelve todos los invitados de la pareja que inició sesión, cada uno con su estado:
// pendiente, confirmado o no viene. Solo los de ella: el invite_id sale de la cookie,
// no de lo que mande el navegador.

import { getSession, jsonResponse } from "../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const inviteId = await getSession(request, env);
  if (!inviteId) return jsonResponse({ error: "not_logged_in" }, 401);

  const couple = await env.DB
    .prepare("SELECT names FROM couples WHERE invite_id = ?")
    .bind(inviteId)
    .first();
  if (!couple) return jsonResponse({ error: "not_logged_in" }, 401);

  // Todos los invitados de la lista, con su respuesta si ya la enviaron.
  const { results: rows } = await env.DB
    .prepare(
      `SELECT g.id, g.name, g.passes,
              r.attending, r.guests_count, r.dietary, r.message, r.created_at
       FROM guests g
       LEFT JOIN rsvps r ON r.guest_id = g.id
       WHERE g.invite_id = ?
       ORDER BY g.name`
    )
    .bind(inviteId)
    .all();

  const guests = rows.map((r) => ({
    id: r.id,
    name: r.name,
    passes: r.passes,
    status: r.attending === null ? "pending" : r.attending === 1 ? "confirmed" : "declined",
    guests_count: r.attending === 1 ? r.guests_count : 0,
    dietary: r.dietary,
    message: r.message,
    created_at: r.created_at,
  }));

  // Respuestas que no están enlazadas a ningún invitado de la lista
  // (por ejemplo, las de prueba). Se muestran aparte para que no se pierdan.
  const { results: others } = await env.DB
    .prepare(
      `SELECT id, guest_name, attending, guests_count, dietary, message, created_at
       FROM rsvps WHERE invite_id = ? AND guest_id IS NULL ORDER BY id DESC`
    )
    .bind(inviteId)
    .all();

  return jsonResponse({ names: couple.names, guests, others });
}
