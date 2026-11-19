// Panel de la boda: muestra los invitados con su estado y deja agregar, editar y borrar.
// Si no hay sesión iniciada, manda a la página de entrada.
// El administrador llega aquí desde /admin con ?c=nombre-corto-de-la-boda.

const C = new URLSearchParams(window.location.search).get("c");
const Q = C ? "?c=" + encodeURIComponent(C) : "";

const ESTADOS = {
  confirmed: "Confirmó",
  declined: "No viene",
  pending: "Sin responder",
};

const MENSAJES = {
  invalid_name: "Falta el nombre.",
  name_needs_surname: "Escribe nombre y apellido, así lo encuentran en la invitación.",
  invalid_passes: "Los pases deben ser un número del 1 al 10.",
  invalid_phone: "Escribe el número de celular completo (de 7 a 15 dígitos). Es lo que el invitado usa para confirmar.",
  duplicate_name: "Ya hay un invitado con ese nombre. Agrega un apellido o una inicial para distinguirlos.",
  guest_limit: "Se llegó al máximo de 1000 invitados por boda.",
  too_many: "Son demasiados a la vez. Agrégalos en grupos de 500.",
  guest_not_found: "Ese invitado ya no está en la lista.",
  forbidden: "No tienes permiso para hacer eso.",
};
const GENERICO = "Algo salió mal. Inténtalo otra vez en un momento.";

let invitados = [];

// --- Pedidos al servidor -------------------------------------------------

async function pedir(ruta, metodo = "GET", cuerpo) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  let res;
  try {
    res = await fetch(ruta + Q, opciones);
  } catch {
    return { ok: false, status: 0, datos: { error: "network" } };
  }
  if (res.status === 401) {
    window.location.href = "/login";
    return { ok: false, status: 401, datos: {} };
  }
  const datos = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, datos };
}

function mensajeDe(datos) {
  if (datos.error === "network") return "No pudimos conectarnos. Revisa tu internet.";
  if (datos.error === "passes_below_confirmed") {
    return `Ya confirmó ${datos.confirmed} personas, no puedes dejarle menos pases.`;
  }
  return MENSAJES[datos.error] || GENERICO;
}

// --- Dibujar -------------------------------------------------------------

// textContent evita que un invitado pueda meter código en la página
function celda(texto, etiqueta) {
  const td = document.createElement("td");
  td.textContent = texto;
  // En el celular cada fila se vuelve una tarjeta: la etiqueta dice qué es cada dato
  // y las celdas vacías (—) se esconden.
  if (etiqueta) td.dataset.label = etiqueta;
  if (texto === "—") td.classList.add("empty");
  return td;
}

function dibujarFilas(tbody, filas) {
  tbody.replaceChildren();
  for (const celdas of filas) {
    const fila = document.createElement("tr");
    for (const texto of celdas) fila.appendChild(celda(texto));
    tbody.appendChild(fila);
  }
}

function boton(texto, clases, alHacerClic, etiqueta) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-small " + clases;
  b.textContent = texto;
  if (etiqueta) b.setAttribute("aria-label", etiqueta);
  b.addEventListener("click", alHacerClic);
  return b;
}

function notas(g) {
  const partes = [];
  // Invitados cargados cuando bastaban los últimos 4 dígitos: hay que completar el número.
  if (g.phone.replace(/\D/g, "").length < 7) partes.push("⚠ Falta el celular completo");
  if (g.dietary) partes.push("Comida: " + g.dietary);
  if (g.message) partes.push("“" + g.message + "”");
  return partes.join(" · ") || "—";
}

function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function dibujarTabla() {
  const busqueda = normalizar(document.getElementById("filter").value.trim());
  const visibles = invitados.filter((g) => !busqueda || normalizar(g.name).includes(busqueda));

  const tbody = document.getElementById("rows");
  tbody.replaceChildren();
  for (const g of visibles) {
    const fila = document.createElement("tr");
    fila.appendChild(celda(g.name));
    fila.appendChild(celda(g.passes, "Pases"));

    const estado = document.createElement("td");
    const pastilla = document.createElement("span");
    pastilla.className = "pill " + g.status;
    pastilla.textContent = ESTADOS[g.status];
    estado.appendChild(pastilla);
    fila.appendChild(estado);

    fila.appendChild(celda(g.status === "confirmed" ? `${g.guests_count} de ${g.passes}` : "—", "Vienen"));
    fila.appendChild(celda(notas(g), "Notas"));

    const acciones = document.createElement("td");
    acciones.className = "actions";
    acciones.appendChild(boton("Editar", "btn-ghost", () => abrirEdicion(g), "Editar a " + g.name));
    acciones.appendChild(boton("Eliminar", "btn-danger", () => eliminar(g), "Eliminar a " + g.name));
    fila.appendChild(acciones);

    tbody.appendChild(fila);
  }

  document.getElementById("table").hidden = visibles.length === 0;
  document.getElementById("no-match").hidden = !(busqueda && invitados.length > 0 && visibles.length === 0);
}

async function cargar() {
  const { ok, status, datos } = await pedir("/api/rsvps");
  if (status === 401) return;
  if (status === 404 && C) {
    window.location.href = "/admin";
    return;
  }
  if (!ok) {
    document.getElementById("title").textContent = "No pudimos cargar tus respuestas";
    return;
  }

  const { names, guests, others, role } = datos;
  invitados = guests;

  document.getElementById("title").textContent = names;

  // El administrador ve un aviso para volver; el modo de prueba es solo para parejas.
  const aviso = document.getElementById("admin-banner");
  aviso.hidden = role !== "admin";
  if (role === "admin") {
    const volver = document.createElement("a");
    volver.href = "/admin";
    volver.textContent = "← Todas las bodas";
    aviso.replaceChildren(volver, document.createTextNode(" · Estás administrando esta boda."));
  }
  document.getElementById("test-section").hidden = role === "admin";

  // Resumen
  const confirmaron = guests.filter((g) => g.status === "confirmed");
  const sueltasQueVienen = others.filter((r) => r.attending === 1);
  document.getElementById("count-yes").textContent = confirmaron.length + sueltasQueVienen.length;
  document.getElementById("count-no").textContent =
    guests.filter((g) => g.status === "declined").length +
    others.filter((r) => r.attending !== 1).length;
  document.getElementById("count-pending").textContent =
    guests.filter((g) => g.status === "pending").length;
  document.getElementById("count-people").textContent =
    confirmaron.reduce((suma, g) => suma + g.guests_count, 0) +
    sueltasQueVienen.reduce((suma, r) => suma + r.guests_count, 0);

  // Invitados de la lista
  document.getElementById("empty").hidden = guests.length !== 0;
  document.getElementById("filter").hidden = guests.length < 8;
  dibujarTabla();

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

// --- Selectores de pases (1 a 10) -----------------------------------------

function llenarPases(select, elegido = 1) {
  select.replaceChildren();
  for (let n = 1; n <= 10; n++) {
    const opcion = new Option(String(n), String(n));
    opcion.selected = n === elegido;
    select.appendChild(opcion);
  }
}

// --- Agregar uno -----------------------------------------------------------

function mostrar(elemento, texto, tipo) {
  elemento.className = "feedback " + (tipo || "");
  elemento.textContent = texto;
}

// Se aceptan espacios, guiones y el +; el servidor se queda solo con los dígitos.
function limpiarCelular(e) {
  e.target.value = e.target.value.replace(/[^\d+\s()-]/g, "");
}
document.getElementById("add-phone").addEventListener("input", limpiarCelular);

document.getElementById("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const aviso = document.getElementById("add-feedback");
  const nombre = document.getElementById("add-name");
  const pases = document.getElementById("add-passes");
  const celular = document.getElementById("add-phone");
  const enviar = event.target.querySelector("button[type=submit]");

  enviar.disabled = true;
  mostrar(aviso, "Agregando…");
  const { ok, datos } = await pedir("/api/guests", "POST", {
    guests: [{ line: 1, name: nombre.value, passes: pases.value, phone: celular.value }],
  });
  enviar.disabled = false;

  if (!ok && datos.error) return mostrar(aviso, mensajeDe(datos), "bad");
  if (datos.failed && datos.failed.length > 0) {
    return mostrar(aviso, mensajeDe({ error: datos.failed[0].error }), "bad");
  }

  mostrar(aviso, `Se agregó ${nombre.value.trim()}.`, "ok");
  nombre.value = "";
  celular.value = "";
  llenarPases(pases, 1);
  nombre.focus();
  cargar();
});

// --- Agregar varios --------------------------------------------------------

// Cada línea: nombre, pases, celular. Separados por coma, punto y coma o tabulador
// (así se puede pegar desde una hoja de cálculo).
function leerLineas(texto) {
  const filas = [];
  texto.split(/\r?\n/).forEach((original, i) => {
    if (!original.trim()) return;
    const partes = original.split(/[\t;,]/).map((p) => p.trim());
    // Si pegaron la fila de títulos de una hoja ("Nombre, Pases, Celular"), se salta.
    if (filas.length === 0 && /^nombre/i.test(partes[0]) && Number.isNaN(Number(partes[1]))) return;
    filas.push({
      line: i + 1,
      original,
      name: partes[0],
      passes: partes[1] === undefined || partes[1] === "" ? 1 : partes[1],
      phone: partes[2] ?? "",
    });
  });
  return filas;
}

document.getElementById("bulk-add").addEventListener("click", async (event) => {
  const area = document.getElementById("bulk-text");
  const aviso = document.getElementById("bulk-feedback");
  const filas = leerLineas(area.value);
  if (filas.length === 0) return mostrar(aviso, "Escribe o pega al menos un invitado.", "bad");

  event.target.disabled = true;
  mostrar(aviso, "Agregando…");
  const { ok, datos } = await pedir(
    "/api/guests",
    "POST",
    { guests: filas.map(({ line, name, passes, phone }) => ({ line, name, passes, phone })) }
  );
  event.target.disabled = false;

  if (!ok && datos.error) return mostrar(aviso, mensajeDe(datos), "bad");

  const fallidos = datos.failed || [];
  const agregados = datos.added || 0;
  aviso.replaceChildren();
  aviso.className = "feedback " + (fallidos.length ? "bad" : "ok");

  const resumen = document.createElement("div");
  resumen.textContent =
    (agregados === 1 ? "Se agregó 1 invitado." : `Se agregaron ${agregados} invitados.`) +
    (fallidos.length
      ? ` ${fallidos.length === 1 ? "1 no se pudo agregar" : fallidos.length + " no se pudieron agregar"} y se quedó en el cuadro para que lo corrijas:`
      : "");
  aviso.appendChild(resumen);

  if (fallidos.length) {
    const lista = document.createElement("ul");
    lista.className = "problems";
    for (const f of fallidos) {
      const li = document.createElement("li");
      li.textContent = `Línea ${f.line}${f.name ? " (" + f.name + ")" : ""}: ${mensajeDe({ error: f.error })}`;
      lista.appendChild(li);
    }
    aviso.appendChild(lista);
  }

  // En el cuadro quedan solo las líneas que fallaron, para corregirlas y volver a enviar.
  const quedan = new Set(fallidos.map((f) => f.line));
  area.value = filas.filter((f) => quedan.has(f.line)).map((f) => f.original).join("\n");
  if (agregados > 0) cargar();
});

// --- Editar ----------------------------------------------------------------

const dialogo = document.getElementById("edit-dialog");
let editando = null;

function abrirEdicion(g) {
  editando = g;
  document.getElementById("edit-name").value = g.name;
  llenarPases(document.getElementById("edit-passes"), g.passes);
  document.getElementById("edit-phone").value = g.phone;
  document.getElementById("edit-feedback").textContent = "";
  dialogo.showModal();
}

document.getElementById("edit-phone").addEventListener("input", limpiarCelular);
document.getElementById("edit-cancel").addEventListener("click", () => dialogo.close());

document.getElementById("edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editando) return;
  const aviso = document.getElementById("edit-feedback");
  const guardar = event.target.querySelector("button[type=submit]");

  guardar.disabled = true;
  const { ok, datos } = await pedir(`/api/guests/${editando.id}`, "PUT", {
    name: document.getElementById("edit-name").value,
    passes: document.getElementById("edit-passes").value,
    phone: document.getElementById("edit-phone").value,
  });
  guardar.disabled = false;

  if (!ok) {
    aviso.textContent = mensajeDe(datos);
    return;
  }
  dialogo.close();
  cargar();
});

// --- Eliminar --------------------------------------------------------------

async function eliminar(g) {
  const seguro = await confirmar({
    titulo: `Eliminar a ${g.name}`,
    mensaje:
      g.status === "pending"
        ? "Se quita de la lista de invitados."
        : "Se quita de la lista y su respuesta también se borra. Esto no se puede deshacer.",
    confirmar: "Eliminar",
    peligro: true,
  });
  if (!seguro) return;

  const { ok, datos } = await pedir(`/api/guests/${g.id}`, "DELETE");
  if (!ok) {
    await avisar("No se pudo eliminar", mensajeDe(datos));
    return;
  }
  cargar();
}

// --- Resto -----------------------------------------------------------------

document.getElementById("filter").addEventListener("input", dibujarTabla);

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});

document.getElementById("test").addEventListener("click", async () => {
  await fetch("/api/test-rsvp", { method: "POST" });
  cargar();
});

llenarPases(document.getElementById("add-passes"), 1);
cargar();
