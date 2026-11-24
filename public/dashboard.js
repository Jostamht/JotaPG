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
let enlaceInvitacion = "";
let nombresPareja = "";
let idBoda = "";

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

// --- WhatsApp --------------------------------------------------------------
// El mensaje, el código de país y a quién ya se le envió se guardan en este navegador.

const MENSAJE_ORIGINAL =
  "¡Hola {nombre}! Con mucho cariño te invitamos a nuestra boda. Aquí está tu invitación: {enlace}\n\n" +
  "Para confirmar tu asistencia, escribe tu nombre y tu número de celular completo.\n\n{pareja}";
const CODIGO_ORIGINAL = "591";

function guardado(clave, porDefecto) {
  try {
    return localStorage.getItem(clave) ?? porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento el mensaje funciona igual, solo no se recuerda.
  }
}

function enviados() {
  try {
    return new Set(JSON.parse(guardado("jp-wa-enviados-" + idBoda, "[]")));
  } catch {
    return new Set();
  }
}

function numeroWhatsApp(celular) {
  const codigo = document.getElementById("wa-country").value.replace(/\D/g, "");
  let d = celular.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length < 7) return "";
  if (codigo && !(d.startsWith(codigo) && d.length >= codigo.length + 7)) d = codigo + d;
  return d;
}

function mensajePara(g) {
  const primerNombre = g.name.trim().split(/\s+/)[0];
  return document
    .getElementById("wa-message")
    .value.replaceAll("{nombre}", primerNombre)
    .replaceAll("{enlace}", enlaceInvitacion)
    .replaceAll("{pareja}", nombresPareja);
}

function botonWhatsApp(g) {
  const numero = numeroWhatsApp(g.phone);
  if (!numero) return null;
  const a = document.createElement("a");
  a.className = "btn-small btn-wa";
  a.href = `https://wa.me/${numero}?text=${encodeURIComponent(mensajePara(g))}`;
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("aria-label", "Enviar invitación por WhatsApp a " + g.name);
  const yaSeEnvio = enviados().has(g.id);
  const marcarEnviado = () => {
    a.textContent = "✓ Enviado";
    a.classList.add("sent");
    a.title = "Ya se abrió el mensaje para esta persona. Toca para enviarlo otra vez.";
  };
  if (yaSeEnvio) marcarEnviado();
  else a.textContent = "WhatsApp";
  a.addEventListener("click", () => {
    const lista = enviados();
    lista.add(g.id);
    guardar("jp-wa-enviados-" + idBoda, JSON.stringify([...lista]));
    marcarEnviado();
  });
  return a;
}

function prepararWhatsApp() {
  const mensaje = document.getElementById("wa-message");
  const pais = document.getElementById("wa-country");
  mensaje.value = guardado("jp-wa-mensaje", MENSAJE_ORIGINAL);
  pais.value = guardado("jp-wa-pais", CODIGO_ORIGINAL);
  mensaje.addEventListener("input", () => {
    guardar("jp-wa-mensaje", mensaje.value);
    dibujarTabla();
  });
  pais.addEventListener("input", () => {
    pais.value = pais.value.replace(/\D/g, "");
    guardar("jp-wa-pais", pais.value);
    dibujarTabla();
  });
  document.getElementById("wa-reset").addEventListener("click", () => {
    mensaje.value = MENSAJE_ORIGINAL;
    guardar("jp-wa-mensaje", MENSAJE_ORIGINAL);
    dibujarTabla();
  });
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
    fila.appendChild(celda(g.phone || "—", "Celular")).classList.add("phone");
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
    const wa = botonWhatsApp(g);
    if (wa) acciones.appendChild(wa);
    acciones.appendChild(boton("Editar", "btn-ghost", () => abrirEdicion(g), "Editar a " + g.name));
    acciones.appendChild(boton("Eliminar", "btn-danger", () => eliminar(g), "Eliminar a " + g.name));
    fila.appendChild(acciones);

    tbody.appendChild(fila);
  }

  document.getElementById("table").hidden = visibles.length === 0;
  document.getElementById("no-match").hidden = !(busqueda && invitados.length > 0 && visibles.length === 0);
}

// --- Descargar la lista ----------------------------------------------------------

// Una celda del archivo. Se separa con «;» porque así lo espera Excel en español.
// Si un texto empieza con = + - @ se le antepone una comilla: así Excel no lo toma como fórmula
// (el mensaje lo escribe el invitado, no la pareja).
function celdaCsv(valor, esTexto) {
  let t = String(valor ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim();
  if (esTexto && /^[=+\-@\t]/.test(t)) t = "'" + t;
  return /[";]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

function listaEnCsv() {
  const filas = [["Invitado", "Celular", "Pases", "Estado", "Personas que vienen", "Mensaje"]];
  for (const g of invitados) {
    filas.push([
      celdaCsv(g.name, true),
      celdaCsv(g.phone),
      celdaCsv(g.passes),
      celdaCsv(ESTADOS[g.status]),
      celdaCsv(g.status === "confirmed" ? g.guests_count : 0),
      celdaCsv(g.message, true),
    ]);
  }
  // El \ufeff del principio hace que Excel lea bien las tildes y la ñ.
  return "\ufeff" + filas.map((f) => f.join(";")).join("\r\n") + "\r\n";
}

function descargarLista() {
  const archivo = new Blob([listaEnCsv()], { type: "text/csv;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = "invitados-" + (idBoda || "boda") + ".csv";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

document.getElementById("download-csv").addEventListener("click", descargarLista);

// --- Cuenta regresiva ----------------------------------------------------------

let reloj = null;

function fechaDeBoda(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto || "");
  if (!m) return null;
  const [a, mes, d, h, min] = m.slice(1).map(Number);
  return new Date(a, mes - 1, d, h, min);
}

function dosCifras(n) {
  return String(n).padStart(2, "0");
}

function prepararCuentaRegresiva(texto) {
  clearInterval(reloj);
  const caja = document.getElementById("countdown");
  const boda = fechaDeBoda(texto);
  caja.hidden = !boda;
  if (!boda) return;

  document.getElementById("cd-date").textContent =
    boda.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
    " · " +
    boda.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

  const cuadricula = document.getElementById("cd-grid");
  const mensaje = document.getElementById("cd-message");
  const rotulo = document.getElementById("cd-kicker");

  function actualizar() {
    const falta = boda.getTime() - Date.now();
    if (falta > 0) {
      const seg = Math.floor(falta / 1000);
      const dias = Math.floor(seg / 86400);
      cuadricula.hidden = false;
      mensaje.hidden = true;
      rotulo.textContent = "Faltan para la boda";
      document.getElementById("cd-d").textContent = dias;
      document.getElementById("cd-d-l").textContent = dias === 1 ? "día" : "días";
      document.getElementById("cd-h").textContent = dosCifras(Math.floor((seg % 86400) / 3600));
      document.getElementById("cd-m").textContent = dosCifras(Math.floor((seg % 3600) / 60));
      document.getElementById("cd-s").textContent = dosCifras(seg % 60);
      return;
    }
    cuadricula.hidden = true;
    mensaje.hidden = false;
    const hoy = new Date();
    const mismoDia =
      hoy.getFullYear() === boda.getFullYear() &&
      hoy.getMonth() === boda.getMonth() &&
      hoy.getDate() === boda.getDate();
    rotulo.textContent = mismoDia ? "¡Es hoy!" : "¡Felicidades!";
    mensaje.textContent = mismoDia ? "Hoy es el gran día." : "Ya pasó el gran día. Que lo disfruten mucho.";
    clearInterval(reloj);
  }
  actualizar();
  reloj = setInterval(actualizar, 1000);
}

// --- Gráfica circular y barra de personas ---------------------------------

const NS = "http://www.w3.org/2000/svg";
const RADIO = 48;
const VUELTA = 2 * Math.PI * RADIO;

function anillo(color, largo, inicio) {
  const c = document.createElementNS(NS, "circle");
  c.setAttribute("cx", "60");
  c.setAttribute("cy", "60");
  c.setAttribute("r", String(RADIO));
  c.setAttribute("fill", "none");
  c.style.stroke = color;
  c.setAttribute("stroke-width", "14");
  c.setAttribute("transform", "rotate(-90 60 60)");
  c.setAttribute("stroke-dashoffset", String(-inicio));
  c.setAttribute("stroke-dasharray", `0 ${VUELTA}`);
  c.classList.add("donut-seg");
  // Se dibuja desde cero para que la gráfica "crezca" al abrir el panel.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => c.setAttribute("stroke-dasharray", `${largo} ${VUELTA - largo}`))
  );
  return c;
}

function dibujarResumen(guests, others) {
  const si = guests.filter((g) => g.status === "confirmed").length + others.filter((r) => r.attending === 1).length;
  const no = guests.filter((g) => g.status === "declined").length + others.filter((r) => r.attending !== 1).length;
  const faltan = guests.filter((g) => g.status === "pending").length;
  const total = si + no + faltan;

  document.getElementById("legend-yes").textContent = si;
  document.getElementById("legend-no").textContent = no;
  document.getElementById("legend-pending").textContent = faltan;
  document.getElementById("donut-pct").textContent = total ? Math.round(((si + no) / total) * 100) + "%" : "—";

  const svg = document.getElementById("donut");
  svg.replaceChildren();
  const fondo = document.createElementNS(NS, "circle");
  fondo.setAttribute("cx", "60");
  fondo.setAttribute("cy", "60");
  fondo.setAttribute("r", String(RADIO));
  fondo.setAttribute("fill", "none");
  fondo.style.stroke = "var(--suave)";
  fondo.setAttribute("stroke-width", "14");
  svg.appendChild(fondo);

  let inicio = 0;
  for (const [cantidad, color] of [[si, "var(--verde-grafica)"], [no, "var(--rojo-grafica)"], [faltan, "var(--gris-grafica)"]]) {
    if (!cantidad) continue;
    const largo = (cantidad / total) * VUELTA;
    svg.appendChild(anillo(color, largo, inicio));
    inicio += largo;
  }
  svg.setAttribute(
    "aria-label",
    total
      ? `${si} confirmaron, ${no} no vienen, ${faltan} sin responder`
      : "Todavía no hay invitados"
  );

  // Barra: personas confirmadas de los pases repartidos a la lista.
  const pases = guests.reduce((suma, g) => suma + g.passes, 0);
  const personas = guests
    .filter((g) => g.status === "confirmed")
    .reduce((suma, g) => suma + g.guests_count, 0);
  document.getElementById("bar-people").textContent = personas;
  document.getElementById("bar-text").textContent = pases
    ? `de ${pases} pases confirmados`
    : "personas confirmadas";
  const relleno = document.getElementById("bar-fill");
  relleno.style.width = "0%";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      relleno.style.width = pases ? Math.min(100, (personas / pases) * 100) + "%" : "0%";
    })
  );
}

async function cargar() {
  const { ok, status, datos } = await pedir("/api/rsvps");
  if (status === 401) return;
  if (status === 404 && C) {
    window.location.href = "/admin";
    return;
  }
  if (!ok) {
    document.getElementById("hello").hidden = true;
    document.getElementById("title").textContent = "No pudimos cargar tus respuestas";
    return;
  }

  const { names, guests, others, role } = datos;
  invitados = guests;
  enlaceInvitacion = datos.invite_url;
  nombresPareja = names;
  idBoda = datos.invite_id;

  document.getElementById("title").textContent = names;
  prepararCuentaRegresiva(datos.wedding_date);

  // El administrador ve un aviso para volver.
  const aviso = document.getElementById("admin-banner");
  aviso.hidden = role !== "admin";
  if (role === "admin") {
    const volver = document.createElement("a");
    volver.href = "/admin";
    volver.textContent = "← Todas las bodas";
    aviso.replaceChildren(volver, document.createTextNode(" · Estás administrando esta boda."));
  }

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

  dibujarResumen(guests, others);

  // Invitados de la lista
  document.getElementById("empty").hidden = guests.length !== 0;
  document.getElementById("filter").hidden = guests.length < 8;
  document.getElementById("download-box").hidden = guests.length === 0;
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

llenarPases(document.getElementById("add-passes"), 1);
prepararWhatsApp();
cargar();
