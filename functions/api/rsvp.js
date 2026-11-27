// POST /api/rsvp — recibe la confirmación de un invitado desde el sitio de una pareja.
// El CORS se valida contra el dominio registrado de cada pareja (tabla couples).
// El invitado se valida contra la lista de la pareja (tabla guests): nombre,
// número de celular completo y cantidad de pases; o, en las bodas con link personal,
// el código privado de su link (ver rsvp_mode en couples).

import {
  handleOptions,
  json,
  getCoupleForOrigin,
  getGuests,
  getGuestByCode,
  findGuest,
} from "../../lib/invite-api.js";
import { phonesMatch } from "../../lib/guests.js";
import { verifyTurnstile } from "../../lib/turnstile.js";
import { isLocked, recordFail, clearFails } from "../../lib/attempts.js";

const MAX = { name: 100, dietary: 300, message: 500 };

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

  // Misma respuesta si la invitación no existe o el origen no coincide.
  if (!couple) return json({ error: "forbidden" }, 403);

  // Anti-spam: Cloudflare debe confirmar que quien envía es una persona.
  const human = await verifyTurnstile(env, data.turnstile_token, request.headers.get("CF-Connecting-IP"));
  if (human.notConfigured) {
    console.error("rsvp: falta el secreto TURNSTILE_SECRET en Cloudflare; no se aceptan confirmaciones.");
    return json({ error: "turnstile_not_configured" }, 503, origin);
  }
  if (!human.ok) return json({ error: "turnstile_failed" }, 403, origin);

  const typedName = String(data.guest_name ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const code = String(data.guest_code ?? "").trim();
  const dietary = String(data.dietary ?? "").trim();
  const message = String(data.message ?? "").trim();
  const attending = data.attending === true || data.attending === 1 ? 1 : 0;
  const guestsCount = attending ? Number.parseInt(data.guests_count ?? 1, 10) : 0;

  // Cómo confirma esta boda (lo elige el administrador):
  //   typed = nombre y celular (el modo de siempre; un código que llegue se ignora)
  //   link  = solo con el código del link personal; no se acepta nombre y celular
  //   both  = con código si lo trae; si no, nombre y celular (pensado solo para la muestra)
  const mode = couple.rsvp_mode;
  if (mode === "link" && !code) return json({ error: "link_required" }, 403, origin);
  const byLink = mode === "link" || (mode === "both" && code !== "");

  if (!byLink && (!typedName || typedName.length > MAX.name)) {
    return json({ error: "invalid_name" }, 400, origin);
  }
  if (dietary.length > MAX.dietary || message.length > MAX.message) {
    return json({ error: "text_too_long" }, 400, origin);
  }

  let guest;
  if (byLink) {
    // Quién es: el código del link lo dice. No hay celular que comparar, y como el código
    // es de 16 caracteres al azar, tampoco se puede adivinar probando.
    guest = await getGuestByCode(env, inviteId, code);
    if (!guest) return json({ error: "guest_not_found" }, 404, origin);
  } else {
    // Quién es: se busca en la lista de la pareja. Lo que se guarda es el nombre
    // de la lista, no el que escribió el invitado.
    guest = findGuest(await getGuests(env, inviteId), typedName).guest;
    if (!guest) return json({ error: "guest_not_found" }, 404, origin);

    // Bloqueo temporal tras varios celulares equivocados para este invitado.
    if (await isLocked(env, inviteId, guest.id)) {
      return json({ error: "too_many_attempts" }, 429, origin);
    }

    if (!phonesMatch(guest.phone, phone)) {
      const nowLocked = await recordFail(env, inviteId, guest.id);
      return nowLocked
        ? json({ error: "too_many_attempts" }, 429, origin)
        : json({ error: "wrong_phone" }, 403, origin);
    }
  }

  // Si viene, tiene que venir al menos 1 persona (la invitación manda «no vengo» como attending: false).
  if (!Number.isInteger(guestsCount) || guestsCount < (attending ? 1 : 0) || guestsCount > guest.passes) {
    return json({ error: "invalid_guests_count" }, 400, origin);
  }

  // Si el mismo invitado vuelve a confirmar (por ejemplo, cambió de opinión),
  // su respuesta anterior se reemplaza para que no cuente doble.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rsvps WHERE guest_id = ?").bind(guest.id),
    env.DB
      .prepare(
        `INSERT INTO rsvps (invite_id, guest_id, guest_name, attending, guests_count, dietary, message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(inviteId, guest.id, guest.name, attending, guestsCount, dietary || null, message || null),
  ]);

  if (!byLink) await clearFails(env, inviteId, guest.id);
  return json({ ok: true }, 201, origin);
}
