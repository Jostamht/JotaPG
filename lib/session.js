// ------------------------------------------------------------
// La "llave" de sesión.
// Cuando una pareja entra con su código, le damos una cookie firmada
// que dice "esta persona es juancarlos". Sin la firma secreta nadie
// puede inventarse una cookie falsa.
// ------------------------------------------------------------

const COOKIE_NAME = "jp_session";
const SEVEN_DAYS = 7 * 24 * 60 * 60; // segundos
const enc = new TextEncoder();

function toBase64Url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function getKey(env) {
  if (!env.SESSION_SECRET) {
    throw new Error("Falta SESSION_SECRET (ver README, paso del secreto).");
  }
  return crypto.subtle.importKey(
    "raw",
    enc.encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Crea el texto de la cookie para esta pareja.
export async function makeSessionCookie(env, inviteId) {
  const payload = toBase64Url(
    enc.encode(JSON.stringify({ i: inviteId, e: Math.floor(Date.now() / 1000) + SEVEN_DAYS }))
  );
  const sig = await crypto.subtle.sign("HMAC", await getKey(env), enc.encode(payload));
  const value = `${payload}.${toBase64Url(new Uint8Array(sig))}`;
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SEVEN_DAYS}; HttpOnly; Secure; SameSite=Lax`;
}

// Texto de cookie que borra la sesión (para "Salir").
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Lee la cookie de la petición. Devuelve el invite_id de la pareja, o null.
export async function getSession(request, env) {
  const cookies = request.headers.get("Cookie") || "";
  const match = cookies.split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE_NAME + "="));
  if (!match) return null;

  const [payload, sig] = match.slice(COOKIE_NAME.length + 1).split(".");
  if (!payload || !sig) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(env),
      fromBase64Url(sig),
      enc.encode(payload)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (!data.i || data.e < Math.floor(Date.now() / 1000)) return null;
    return data.i;
  } catch {
    return null;
  }
}

// Respuesta JSON que nunca se guarda en caché.
export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}
