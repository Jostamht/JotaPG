// ------------------------------------------------------------
// Verificación anti-spam (Cloudflare Turnstile).
// La invitación manda un "token" que prueba que el visitante pasó la revisión de Cloudflare;
// aquí se le pregunta a Cloudflare si ese token es verdadero.
// Si el secreto TURNSTILE_SECRET todavía no existe en Cloudflare, no se exige nada
// (así el sitio no se rompe a medias mientras se configura).
// ------------------------------------------------------------

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return { ok: true, skipped: true };
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
