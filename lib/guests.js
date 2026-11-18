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

// ¿El número que escribió el invitado es el que tiene la pareja en su lista?
// Se comparan solo los dígitos. Vale con o sin el código de país: «71234567» y
// «59171234567» son el mismo número. Como un código de país tiene de 1 a 3 dígitos,
// lo que sobra en el más largo no puede pasar de 3 (así no basta con escribir
// solo el final del número).
export function phonesMatch(stored, typed) {
  const a = digitsOnly(stored).replace(/^0+/, "");
  const b = digitsOnly(typed).replace(/^0+/, "");
  if (a.length < MIN_PHONE_DIGITS || b.length < MIN_PHONE_DIGITS) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.length - short.length <= 3 && long.endsWith(short);
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

export async function listGuests(env, inviteId) {
  const { results } = await env.DB
    .prepare("SELECT id, name, passes, phone FROM guests WHERE invite_id = ?")
    .bind(inviteId)
    .all();
  return results;
}
