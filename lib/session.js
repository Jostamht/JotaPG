// ------------------------------------------------------------
// La "llave" de sesión.
// Cuando una pareja entra con su código, le damos una cookie firmada
// que dice "esta persona es juancarlos". Sin la firma secreta nadie
// puede inventarse una cookie falsa.
// El administrador (tú) recibe una cookie igual pero que dice "admin".
// ------------------------------------------------------------

const COOKIE_NAME = "jp_session";
const SEVEN_DAYS = 7 * 24 * 60 * 60; // segundos
const ONE_DAY = 24 * 60 * 60;
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

// Lee un ajuste privado de la tabla "settings". Devuelve null si no existe.
export async function getSetting(env, key) {
  try {
    const row = await env.DB
      .prepare("SELECT value FROM settings WHERE key = ?")
      .bind(key)
      .first();
    return row && row.value ? row.value : null;
  } catch {
    return null; // la tabla todavía no existe
  }
}

// Busca el secreto con el que se firman las cookies:
// 1) primero en la variable SESSION_SECRET de Cloudflare, si existe;
// 2) si no, en la tabla "settings" de la base de datos (clave "session_secret").
async function getSecret(env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const fromDb = await getSetting(env, "session_secret");
  if (fromDb) return fromDb;
  throw new Error("Falta SESSION_SECRET (ver README, paso del secreto).");
}

async function getKey(env) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(await getSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Compara dos textos sin que el tiempo que tarda delate cuántas letras coinciden.
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b))),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Crea el texto de la cookie. Para una pareja, inviteId es el de su boda.
// Para el administrador: makeSessionCookie(env, null, "admin").
export async function makeSessionCookie(env, inviteId, role = "couple") {
  const maxAge = role === "admin" ? ONE_DAY : SEVEN_DAYS;
  const data = { e: Math.floor(Date.now() / 1000) + maxAge };
  if (role === "admin") data.r = "admin";
  else data.i = inviteId;

  const payload = toBase64Url(enc.encode(JSON.stringify(data)));
  const sig = await crypto.subtle.sign("HMAC", await getKey(env), enc.encode(payload));
  const value = `${payload}.${toBase64Url(new Uint8Array(sig))}`;
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

// Texto de cookie que borra la sesión (para "Salir").
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Lee y revisa la cookie de la petición. Devuelve lo que dice, o null si no sirve.
async function readSession(request, env) {
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
    if (!data.e || data.e < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

// Quién hizo el pedido: { role: "admin" }, { role: "couple", inviteId }, o null.
export async function getAuth(request, env) {
  const data = await readSession(request, env);
  if (!data) return null;
  if (data.r === "admin") return { role: "admin" };
  if (data.i) return { role: "couple", inviteId: data.i };
  return null;
}

// Devuelve el invite_id de la pareja que inició sesión, o null.
// (El administrador no cuenta aquí: usa getAuth.)
export async function getSession(request, env) {
  const auth = await getAuth(request, env);
  return auth && auth.role === "couple" ? auth.inviteId : null;
}

// Respuesta JSON que nunca se guarda en caché.
export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}
