// ------------------------------------------------------------
// Reglas para los invitados: se usan al agregar uno, varios o al editar.
// ------------------------------------------------------------

import { normalize } from "./invite-api.js";

export const MAX_GUESTS_PER_WEDDING = 1000;
export const MAX_PER_REQUEST = 500;

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

  // Si pegan el número completo, nos quedamos con los últimos 4 dígitos.
  const digits = String(raw?.phone_last4 ?? "").replace(/\D/g, "");
  if (digits.length < 4) return { error: "invalid_phone" };

  return { guest: { name, passes, phone_last4: digits.slice(-4) } };
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
    .prepare("SELECT id, name, passes, phone_last4 FROM guests WHERE invite_id = ?")
    .bind(inviteId)
    .all();
  return results;
}
