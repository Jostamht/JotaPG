// POST /api/rsvp — recibe la confirmación de un invitado desde el sitio de una pareja.
// El CORS se valida contra el dominio registrado de cada pareja (tabla couples).

const MAX = { name: 100, dietary: 300, message: 500 };

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(origin ? corsHeaders(origin) : {}),
    },
  });
}

// Preflight: el navegador pregunta si el origen tiene permiso (aún no hay body).
export async function onRequestOptions({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin) return new Response(null, { status: 204 });

  const row = await env.DB
    .prepare("SELECT 1 FROM couples WHERE allowed_origin = ? LIMIT 1")
    .bind(origin)
    .first();

  if (!row) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

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
  const couple = await env.DB
    .prepare("SELECT allowed_origin FROM couples WHERE invite_id = ?")
    .bind(inviteId)
    .first();

  // Misma respuesta si la invitación no existe o el origen no coincide.
  if (!couple || couple.allowed_origin !== origin) {
    return json({ error: "forbidden" }, 403);
  }

  const guestName = String(data.guest_name ?? "").trim();
  const dietary = String(data.dietary ?? "").trim();
  const message = String(data.message ?? "").trim();
  const attending = data.attending === true || data.attending === 1 ? 1 : 0;
  const guestsCount = attending ? Number.parseInt(data.guests_count ?? 1, 10) : 0;

  if (!guestName || guestName.length > MAX.name) {
    return json({ error: "invalid_name" }, 400, origin);
  }
  if (!Number.isInteger(guestsCount) || guestsCount < 0 || guestsCount > 10) {
    return json({ error: "invalid_guests_count" }, 400, origin);
  }
  if (dietary.length > MAX.dietary || message.length > MAX.message) {
    return json({ error: "text_too_long" }, 400, origin);
  }

  await env.DB
    .prepare(
      `INSERT INTO rsvps (invite_id, guest_name, attending, guests_count, dietary, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(inviteId, guestName, attending, guestsCount, dietary || null, message || null)
    .run();

  return json({ ok: true }, 201, origin);
}
