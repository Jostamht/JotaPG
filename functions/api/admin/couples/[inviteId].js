// PUT    /api/admin/couples/:inviteId — cambia los nombres o la dirección de la invitación,
//                                       o crea un código de acceso nuevo ({ "regenerate_code": true }).
// DELETE /api/admin/couples/:inviteId — borra la boda con todos sus invitados y respuestas.
// Solo para el administrador.

import { jsonResponse } from "../../../../lib/session.js";
import { requireAdmin } from "../../../../lib/auth.js";
import { normalizeOrigin, freeAccessCode } from "../../../../lib/couples.js";

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env, { write: true });
  if (error) return error;

  const inviteId = String(params.inviteId ?? "");
  const couple = await env.DB
    .prepare("SELECT invite_id, names, allowed_origin, access_code FROM couples WHERE invite_id = ?")
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

  if (data.regenerate_code === true) code = await freeAccessCode(env);

  await env.DB
    .prepare("UPDATE couples SET names = ?, allowed_origin = ?, access_code = ? WHERE invite_id = ?")
    .bind(names, origin, code, inviteId)
    .run();

  return jsonResponse({ invite_id: inviteId, names, allowed_origin: origin, access_code: code });
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

  return jsonResponse({ ok: true });
}
