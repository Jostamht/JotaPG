// GET /api/rsvps
// Devuelve todos los invitados de la boda con su estado: pendiente, confirmado o no viene.
// Una pareja solo ve los suyos (el invite_id sale de la cookie, no de lo que mande el
// navegador). El administrador indica la boda con ?c=invite_id.

import { jsonResponse } from "../../lib/session.js";
import { resolveInvite } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const { error, auth, couple } = await resolveInvite(request, env);
  if (error) return error;
  const inviteId = couple.invite_id;

  // Todos los invitados de la lista, con su respuesta si ya la enviaron.
  const { results: rows } = await env.DB
    .prepare(
      `SELECT g.id, g.name, g.passes, g.phone,
              r.attending, r.guests_count, r.dietary, r.message, r.created_at
       FROM guests g
       LEFT JOIN rsvps r ON r.guest_id = g.id
       WHERE g.invite_id = ?
       ORDER BY g.name COLLATE NOCASE`
    )
    .bind(inviteId)
    .all();

  const guests = rows.map((r) => ({
    id: r.id,
    name: r.name,
    passes: r.passes,
    phone: r.phone,
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

  return jsonResponse({
    role: auth.role,
    invite_id: inviteId,
    names: couple.names,
    invite_url: couple.allowed_origin,
    guests,
    others,
  });
}
