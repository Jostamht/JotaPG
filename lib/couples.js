// ------------------------------------------------------------
// Ayudas para crear y editar bodas desde la página de administración.
// ------------------------------------------------------------

// Sin i, l, o, 0 ni 1 para que no se confundan al leerlos por WhatsApp.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// Código de acceso de una pareja, al azar (10 caracteres, ~8 mil billones de combinaciones).
export function makeCode(length = 10) {
  const limit = 256 - (256 % CODE_ALPHABET.length); // evita favorecer unas letras sobre otras
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && out.length < length) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}

// "Juan y Carla" -> "juan-y-carla"
export function slugify(text) {
  const slug = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return slug || "boda";
}

export const INVITE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;

// Deja solo la dirección del sitio (https, sin ruta ni barra final), que es lo que
// el navegador manda como "Origin". Acepta que peguen el enlace completo.
// Devuelve null si no parece una dirección válida.
export function normalizeOrigin(input) {
  let text = String(input ?? "").trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = "https://" + text;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
  return url.origin;
}

// Un invite_id que no esté usado: "juan-y-carla", "juan-y-carla-2", ...
export async function freeInviteId(env, base) {
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const row = await env.DB
      .prepare("SELECT 1 FROM couples WHERE invite_id = ?")
      .bind(candidate)
      .first();
    if (!row) return candidate;
  }
  return `${base}-${makeCode(4)}`;
}

// Un código de acceso que no esté usado.
export async function freeAccessCode(env) {
  for (let n = 0; n < 10; n++) {
    const code = makeCode();
    const row = await env.DB
      .prepare("SELECT 1 FROM couples WHERE access_code = ?")
      .bind(code)
      .first();
    if (!row) return code;
  }
  throw new Error("No se pudo crear un código único");
}

// Fecha y hora de la boda, como la manda el campo de fecha del navegador: "2026-12-12T16:00".
// Vacío = sin fecha. Devuelve { value } o null si no es una fecha válida.
export function parseWeddingDate(input) {
  if (input === null || input === undefined || String(input).trim() === "") return { value: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(input).trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const check = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (y < 2020 || y > 2100 || h > 23 || mi > 59) return null;
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { value: m[0] };
}
