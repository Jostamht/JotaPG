// POST /api/test-rsvp
// SOLO PARA PRUEBAS: crea una respuesta falsa para la pareja que inició sesión.
// Sirve para ver que la base de datos y el panel funcionan antes de tener invitaciones.
// Cuando ya no se necesite, borrar este archivo y el botón de public/dashboard.html.

import { getSession, jsonResponse } from "../../lib/session.js";

const NOMBRES = ["Ana", "Luis", "Marta", "Diego", "Sofía", "Pablo", "Lucía", "Mateo"];

export async function onRequestPost({ request, env }) {
  const inviteId = await getSession(request, env);
  if (!inviteId) return jsonResponse({ error: "not_logged_in" }, 401);

  const nombre = NOMBRES[Math.floor(Math.random() * NOMBRES.length)] + " (prueba)";
  const viene = Math.random() < 0.7 ? 1 : 0;
  const personas = viene ? 1 + Math.floor(Math.random() * 3) : 0;

  await env.DB
    .prepare(
      "INSERT INTO rsvps (invite_id, guest_name, attending, guests_count) VALUES (?, ?, ?, ?)"
    )
    .bind(inviteId, nombre, viene, personas)
    .run();

  return jsonResponse({ ok: true }, 201);
}
