// ------------------------------------------------------------
// Verificación anti-spam (Cloudflare Turnstile).
// La invitación manda un "token" que prueba que el visitante pasó la revisión de Cloudflare;
// aquí se le pregunta a Cloudflare si ese token es verdadero.
// Si el secreto TURNSTILE_SECRET no existe en Cloudflare, NO se deja pasar nada: las
// confirmaciones se rechazan (503) hasta que el secreto esté puesto. Es mejor que una
// invitación no pueda confirmar por un rato a que quede abierta a cualquier robot.
// ------------------------------------------------------------

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return { ok: false, notConfigured: true };
  const value = String(token ?? "").trim();
  if (!value || value.length > 2048) return { ok: false };

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: value });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body });
    const result = await res.json();
    return { ok: result.success === true };
  } catch {
    // Si Cloudflare no responde, es más seguro no dejar pasar el pedido.
    return { ok: false };
  }
}
