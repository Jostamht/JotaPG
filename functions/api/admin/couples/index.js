// GET  /api/admin/couples — todas las bodas, con sus números.
// POST /api/admin/couples — crea una boda nueva (el código y el nombre corto se crean solos).
// Solo para el administrador.

import { jsonResponse } from "../../../../lib/session.js";
import { requireAdmin } from "../../../../lib/auth.js";
import {
  slugify,
  normalizeOrigin,
  freeInviteId,
  freeAccessCode,
  INVITE_ID_PATTERN,
  parseWeddingDate,
  parseRsvpMode,
} from "../../../../lib/couples.js";

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const { results } = await env.DB
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM guests g WHERE g.invite_id = c.invite_id) AS guests,
         (SELECT COUNT(*) FROM rsvps r JOIN guests g ON g.id = r.guest_id
            WHERE g.invite_id = c.invite_id AND r.attending = 1) AS confirmed,
         (SELECT COUNT(*) FROM rsvps r JOIN guests g ON g.id = r.guest_id
            WHERE g.invite_id = c.invite_id AND r.attending = 0) AS declined,
         (SELECT COALESCE(SUM(r.guests_count), 0) FROM rsvps r JOIN guests g ON g.id = r.guest_id
            WHERE g.invite_id = c.invite_id AND r.attending = 1) AS people
       FROM couples c
       ORDER BY c.created_at DESC, c.id DESC`
    )
    .all();

  const couples = results.map(({ id, ...c }) => ({
    ...c,
    wedding_date: c.wedding_date ?? null,
    rsvp_mode: c.rsvp_mode || "typed",
    pending: c.guests - c.confirmed - c.declined,
  }));
  return jsonResponse({ couples });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env, { write: true });
  if (error) return error;

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const names = String(data.names ?? "").trim().replace(/\s+/g, " ");
  if (!names || names.length > 100) return jsonResponse({ error: "invalid_names" }, 400);

  const origin = normalizeOrigin(data.allowed_origin);
  if (!origin) return jsonResponse({ error: "invalid_origin" }, 400);

  const date = parseWeddingDate(data.wedding_date);
  if (!date) return jsonResponse({ error: "invalid_date" }, 400);

  // Cómo van a confirmar los invitados. Sin elegir, es "typed" (nombre y celular), como siempre.
  const mode = data.rsvp_mode === undefined ? "typed" : parseRsvpMode(data.rsvp_mode);
  if (!mode) return jsonResponse({ error: "invalid_mode" }, 400);

  const originTaken = await env.DB
    .prepare("SELECT 1 FROM couples WHERE allowed_origin = ?")
    .bind(origin)
    .first();
  if (originTaken) return jsonResponse({ error: "origin_in_use" }, 409);

  // Nombre corto: el que pidió (si lo escribió) o uno armado con los nombres.
  const wanted = String(data.invite_id ?? "").trim().toLowerCase();
  let inviteId;
  if (wanted) {
    if (!INVITE_ID_PATTERN.test(wanted)) return jsonResponse({ error: "invalid_invite_id" }, 400);
    const taken = await env.DB.prepare("SELECT 1 FROM couples WHERE invite_id = ?").bind(wanted).first();
    if (taken) return jsonResponse({ error: "invite_id_in_use" }, 409);
    inviteId = wanted;
  } else {
    inviteId = await freeInviteId(env, slugify(names));
  }

  const accessCode = await freeAccessCode(env);
  await env.DB
    .prepare("INSERT INTO couples (invite_id, names, allowed_origin, access_code) VALUES (?, ?, ?, ?)")
    .bind(inviteId, names, origin, accessCode)
    .run();

  // La fecha va aparte: si falta la migración 004, la boda se crea igual y se avisa.
  let dateSaved = true;
  if (date.value) {
    try {
      await env.DB
        .prepare("UPDATE couples SET wedding_date = ? WHERE invite_id = ?")
        .bind(date.value, inviteId)
        .run();
    } catch {
      dateSaved = false;
    }
  }

  // El modo va aparte, igual que la fecha: "typed" es el valor de fábrica y no necesita escribirse;
  // otro modo necesita la migración 007. Si falta, la boda se crea igual (como "typed") y se avisa.
  let modeSaved = true;
  if (mode !== "typed") {
    try {
      await env.DB
        .prepare("UPDATE couples SET rsvp_mode = ? WHERE invite_id = ?")
        .bind(mode, inviteId)
        .run();
    } catch {
      modeSaved = false;
    }
  }

  return jsonResponse(
    {
      invite_id: inviteId,
      names,
      allowed_origin: origin,
      access_code: accessCode,
      wedding_date: dateSaved ? date.value : null,
      rsvp_mode: modeSaved ? mode : "typed",
      ...(dateSaved ? {} : { date_error: "migration_needed" }),
      ...(modeSaved ? {} : { mode_error: "mode_migration_needed" }),
    },
    201
  );
}
