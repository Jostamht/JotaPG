// Pide los invitados a /api/rsvps y los dibuja en la tabla.
// Si no hay sesión iniciada, manda a la página de entrada.

const ESTADOS = {
  confirmed: "Confirmó",
  declined: "No viene",
  pending: "Sin responder",
};

// textContent evita que un invitado pueda meter código en la página
function dibujarFilas(tbody, filas) {
  tbody.replaceChildren();
  for (const celdas of filas) {
    const fila = document.createElement("tr");
    for (const texto of celdas) {
      const td = document.createElement("td");
      td.textContent = texto;
      fila.appendChild(td);
    }
    tbody.appendChild(fila);
  }
}

async function cargar() {
  const res = await fetch("/api/rsvps");

  if (res.status === 401) {
    window.location.href = "/login";
    return;
  }
  if (!res.ok) {
    document.getElementById("title").textContent = "No pudimos cargar tus respuestas";
    return;
  }

  const { names, guests, others } = await res.json();

  document.getElementById("title").textContent = names;

  // Resumen
  const confirmaron = guests.filter((g) => g.status === "confirmed");
  const personasOtras = others
    .filter((r) => r.attending === 1)
    .reduce((suma, r) => suma + r.guests_count, 0);
  document.getElementById("count-yes").textContent =
    confirmaron.length + others.filter((r) => r.attending === 1).length;
  document.getElementById("count-no").textContent =
    guests.filter((g) => g.status === "declined").length +
    others.filter((r) => r.attending !== 1).length;
  document.getElementById("count-pending").textContent =
    guests.filter((g) => g.status === "pending").length;
  document.getElementById("count-people").textContent =
    confirmaron.reduce((suma, g) => suma + g.guests_count, 0) + personasOtras;

  // Invitados de la lista
  dibujarFilas(
    document.getElementById("rows"),
    guests.map((g) => [
      g.name,
      ESTADOS[g.status],
      g.status === "confirmed" ? `${g.guests_count} de ${g.passes}` : "—",
      g.dietary || "—",
      g.message || "—",
    ])
  );
  document.getElementById("table").hidden = guests.length === 0;
  document.getElementById("empty").hidden = guests.length !== 0;

  // Respuestas sueltas (no están en la lista)
  dibujarFilas(
    document.getElementById("others-rows"),
    others.map((r) => [
      r.guest_name,
      r.attending === 1 ? "Sí" : "No",
      r.attending === 1 ? r.guests_count : "—",
      r.dietary || "—",
      r.message || "—",
    ])
  );
  document.getElementById("others-section").hidden = others.length === 0;
}

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});

document.getElementById("test").addEventListener("click", async () => {
  await fetch("/api/test-rsvp", { method: "POST" });
  cargar();
});

cargar();
