// ------------------------------------------------------------
// Reglas para los invitados: se usan al agregar uno, varios o al editar.
// ------------------------------------------------------------

import { normalize } from "./invite-api.js";

export const MAX_GUESTS_PER_WEDDING = 1000;
export const MAX_PER_REQUEST = 500;
export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15; // el máximo de un número internacional

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

// Códigos de país del mundo (1 a 3 dígitos). Solo sirven para saber si los dígitos que
// sobran delante de un número son un código de país de verdad.
const COUNTRY_CODES = new Set(
  (
    "1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 " +
    "81 82 84 86 90 91 92 93 94 95 98 " +
    "211 212 213 216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 " +
    "240 241 242 243 244 245 246 247 248 249 250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 " +
    "266 267 268 269 290 291 297 298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 " +
    "376 377 378 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 504 505 506 507 508 509 590 " +
    "591 592 593 594 595 596 597 598 599 670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 " +
    "688 689 690 691 692 850 852 853 855 856 870 880 960 961 962 963 964 965 966 967 968 970 971 972 973 " +
    "974 975 976 977 992 993 994 995 996 998"
  ).split(" ")
);

// ¿El número que escribió el invitado es el que tiene la pareja en su lista?
// Se comparan solo los dígitos. Vale con o sin el código de país: «71234567» y
// «59171234567» son el mismo número. Pero lo que sobra delante en el más largo tiene que ser
// un código de país real; así no basta con escribir solo el final del número ni con
// inventar dígitos delante.
export function phonesMatch(stored, typed) {
  const a = digitsOnly(stored).replace(/^0+/, "");
  const b = digitsOnly(typed).replace(/^0+/, "");
  if (a.length < MIN_PHONE_DIGITS || b.length < MIN_PHONE_DIGITS) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!long.endsWith(short)) return false;
  const code = long.slice(0, long.length - short.length);
  if (!COUNTRY_CODES.has(code)) return false;
  // Aun así, «7» y «1» también son códigos (Rusia y EE. UU.), y un celular de Bolivia empieza con 7:
  // sin esta revisión bastaría escribir el número sin su primer dígito. Por eso, al quitar el
  // código, lo que queda debe tener un largo razonable para un número nacional.
  if (code.length === 1) return short.length === 10; // EE. UU./Canadá y Rusia: 10 dígitos
  if (code.length === 2) return short.length >= 9;
  return short.length >= 8;
}

// Revisa y limpia un invitado que llega del navegador.
// Devuelve { guest } si está bien, o { error } con el motivo.
export function cleanGuest(raw) {
  const name = String(raw?.name ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 100) return { error: "invalid_name" };

  // La invitación busca por nombre y apellido, así que hacen falta al menos dos palabras.
  if (name.split(" ").length < 2) return { error: "name_needs_surname" };

  const rawPasses = raw?.passes === undefined || raw?.passes === null ? 1 : raw.passes;
  const passes = Number(String(rawPasses).trim());
  if (!Number.isInteger(passes) || passes < 1 || passes > 10) return { error: "invalid_passes" };

  // El celular completo, solo dígitos (se aceptan espacios, guiones y el +).
  const phone = digitsOnly(raw?.phone);
  if (phone.length < MIN_PHONE_DIGITS || phone.length > MAX_PHONE_DIGITS) {
    return { error: "invalid_phone" };
  }

  return { guest: { name, passes, phone } };
}

// ¿Ya hay alguien con ese nombre (sin importar tildes ni mayúsculas)?
// Dos invitados con el mismo nombre harían que ninguno pudiera confirmar.
export function findDuplicate(guests, name, ignoreId = null) {
  const key = normalize(name);
  // ignoreId es el invitado que se está editando (no cuenta contra sí mismo).
  // Los que se agregan en el mismo envío todavía no tienen id y sí cuentan.
  return (
    guests.find((g) => !(ignoreId !== null && g.id === ignoreId) && normalize(g.name) === key) || null
  );
}

// Código privado del link personal de un invitado: 16 letras y números al azar (8 bytes en hexadecimal).
// Es el mismo formato que crea la migración 007 para los invitados que ya existían
// (lib/invite-api.js lo revisa con GUEST_CODE_PATTERN).
export function makeGuestCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Guarda invitados nuevos, cada uno con su código. Si la migración 007 todavía no se corrió
// (no existe la columna guest_code), se guardan sin código y todo sigue funcionando; la migración
// les crea el código después.
export async function insertGuests(env, inviteId, guests) {
  const withCodes = guests.map((g) =>
    env.DB
      .prepare("INSERT INTO guests (invite_id, name, passes, phone, guest_code) VALUES (?, ?, ?, ?, ?)")
      .bind(inviteId, g.name, g.passes, g.phone, makeGuestCode())
  );
  try {
    await env.DB.batch(withCodes);
  } catch (err) {
    if (!/guest_code/i.test(String(err?.message ?? err))) throw err;
    await env.DB.batch(
      guests.map((g) =>
        env.DB
          .prepare("INSERT INTO guests (invite_id, name, passes, phone) VALUES (?, ?, ?, ?)")
          .bind(inviteId, g.name, g.passes, g.phone)
      )
    );
  }
}

export async function listGuests(env, inviteId) {
  const { results } = await env.DB
    .prepare("SELECT id, name, passes, phone FROM guests WHERE invite_id = ?")
    .bind(inviteId)
    .all();
  return results;
}
