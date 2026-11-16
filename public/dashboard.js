// Pide las respuestas a /api/rsvps y las dibuja en la tabla.
// Si no hay sesión iniciada, manda a la página de entrada.

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

  const { names, rsvps } = await res.json();

  document.getElementById("title").textContent = names;

  // Resumen
  const vienen = rsvps.filter((r) => r.attending === 1);
  document.getElementById("count-yes").textContent = vienen.length;
  document.getElementById("count-no").textContent = rsvps.length - vienen.length;
  document.getElementById("count-people").textContent =
    vienen.reduce((suma, r) => suma + r.guests_count, 0);

  // Tabla (textContent evita que un invitado pueda meter código en la página)
  const tbody = document.getElementById("rows");
  tbody.replaceChildren();

  for (const r of rsvps) {
    const fila = document.createElement("tr");
    const celdas = [
      r.guest_name,
      r.attending === 1 ? "Sí" : "No",
      r.attending === 1 ? r.guests_count : "—",
      r.dietary || "—",
      r.message || "—",
    ];
    for (const texto of celdas) {
      const td = document.createElement("td");
      td.textContent = texto;
      fila.appendChild(td);
    }
    tbody.appendChild(fila);
  }

  document.getElementById("table").hidden = rsvps.length === 0;
  document.getElementById("empty").hidden = rsvps.length !== 0;
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
