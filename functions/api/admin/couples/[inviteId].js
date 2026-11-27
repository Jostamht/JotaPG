// PUT    /api/admin/couples/:inviteId — cambia los nombres, la dirección, la fecha o el modo de confirmación
//                                       de la invitación (rsvp_mode: "typed", "link" o "both"),
//                                       o crea un código de acceso nuevo ({ "regenerate_code": true }).
// DELETE /api/admin/couples/:inviteId — borra la boda con todos sus invitados y respuestas.
// Solo para el administrador.

import { jsonResponse } from "../../../../lib/session.js";
import { requireAdmin } from "../../../../lib/auth.js";
import { normalizeOrigin, freeAccessCode, parseWeddingDate, parseRsvpMode } from "../../../../lib/couples.js";
import { forgetWedding } from "../../../../lib/attempts.js";

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env, { write: true });
  if (error) return error;

  const inviteId = String(params.inviteId ?? "");
  const couple = await env.DB
    .prepare("SELECT * FROM couples WHERE invite_id = ?")
    .bind(inviteId)
    .first();
  if (!couple) return jsonResponse({ error: "couple_not_found" }, 404);

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  let names = couple.names;
  let origin = couple.allowed_origin;
  let code = couple.access_code;
  let date = couple.wedding_date ?? null;
  const dateChanged = data.wedding_date !== undefined;
  let mode = couple.rsvp_mode || "typed";
  const modeChanged = data.rsvp_mode !== undefined;

  if (data.names !== undefined) {
    names = String(data.names).trim().replace(/\s+/g, " ");
    if (!names || names.length > 100) return jsonResponse({ error: "invalid_names" }, 400);
  }

  if (data.allowed_origin !== undefined) {
    origin = normalizeOrigin(data.allowed_origin);
    if (!origin) return jsonResponse({ error: "invalid_origin" }, 400);
    const taken = await env.DB
      .prepare("SELECT 1 FROM couples WHERE allowed_origin = ? AND invite_id != ?")
      .bind(origin, inviteId)
      .first();
    if (taken) return jsonResponse({ error: "origin_in_use" }, 409);
  }

  if (dateChanged) {
    const parsed = parseWeddingDate(data.wedding_date);
    if (!parsed) return jsonResponse({ error: "invalid_date" }, 400);
    date = parsed.value;
  }

  if (modeChanged) {
    const parsed = parseRsvpMode(data.rsvp_mode);
    if (!parsed) return jsonResponse({ error: "invalid_mode" }, 400);
    mode = parsed;
  }

  if (data.regenerate_code === true) code = await freeAccessCode(env);

  await env.DB
    .prepare("UPDATE couples SET names = ?, allowed_origin = ?, access_code = ? WHERE invite_id = ?")
    .bind(names, origin, code, inviteId)
    .run();

  // La fecha va aparte: si falta la migración 004, lo demás se guarda y se avisa.
  if (dateChanged) {
    try {
      await env.DB
        .prepare("UPDATE couples SET wedding_date = ? WHERE invite_id = ?")
        .bind(date, inviteId)
        .run();
    } catch {
      return jsonResponse({ error: "migration_needed" }, 500);
    }
  }

  // El modo también va aparte: si falta la migración 007, lo demás se guarda y se avisa.
  // Si no cambió, no se toca (así una boda sigue guardándose aunque la migración no esté).
  if (modeChanged && mode !== (couple.rsvp_mode || "typed")) {
    try {
      await env.DB
        .prepare("UPDATE couples SET rsvp_mode = ? WHERE invite_id = ?")
        .bind(mode, inviteId)
        .run();
    } catch {
      return jsonResponse({ error: "mode_migration_needed" }, 500);
    }
  }

  return jsonResponse({
    invite_id: inviteId,
    names,
    allowed_origin: origin,
    access_code: code,
    wedding_date: date,
    rsvp_mode: mode,
  });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env, { write: true });
  if (error) return error;

  const inviteId = String(params.inviteId ?? "");
  const couple = await env.DB
    .prepare("SELECT invite_id FROM couples WHERE invite_id = ?")
    .bind(inviteId)
    .first();
  if (!couple) return jsonResponse({ error: "couple_not_found" }, 404);

  // En este orden porque cada lista depende de la siguiente:
  // respuestas -> invitados -> boda.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM rsvps WHERE invite_id = ?").bind(inviteId),
    env.DB.prepare("DELETE FROM guests WHERE invite_id = ?").bind(inviteId),
    env.DB.prepare("DELETE FROM couples WHERE invite_id = ?").bind(inviteId),
  ]);
  // Y los intentos de celular equivocado de sus invitados (aparte: si esa tabla no existe, el borrado igual vale).
  await forgetWedding(env, inviteId);

  return jsonResponse({ ok: true });
}
