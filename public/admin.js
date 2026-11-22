// Página del administrador: todas las bodas en un solo lugar.
// Si no hay sesión de administrador, manda a la página de entrada.

const MENSAJES = {
  invalid_names: "Escribe los nombres de la pareja.",
  invalid_origin: "Escribe la dirección de la invitación, por ejemplo https://juancarla.pages.dev",
  origin_in_use: "Esa dirección ya la usa otra boda.",
  invalid_invite_id: "El nombre corto solo puede tener letras minúsculas sin tilde, números y guiones (de 2 a 40 caracteres).",
  invite_id_in_use: "Ese nombre corto ya lo usa otra boda.",
  couple_not_found: "Esa boda ya no existe.",
  forbidden: "No tienes permiso para hacer eso.",
  invalid_date: "La fecha no es válida. Elígela de nuevo.",
  migration_needed: "Para guardar la fecha hay que correr una vez la migración 004 en la base de datos (está en el README).",
};
const GENERICO = "Algo salió mal. Inténtalo otra vez en un momento.";

let bodas = [];

// --- Pedidos al servidor -------------------------------------------------

async function pedir(ruta, metodo = "GET", cuerpo) {
  const opciones = { method: metodo, headers: {} };
  if (cuerpo !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(cuerpo);
  }
  let res;
  try {
    res = await fetch(ruta, opciones);
  } catch {
    return { ok: false, datos: { error: "network" } };
  }
  if (res.status === 401) {
    window.location.href = "/login";
    return { ok: false, datos: {} };
  }
  if (res.status === 403 && metodo === "GET") {
    // Una pareja que llegó aquí por error: su sitio es el panel.
    window.location.href = "/dashboard";
    return { ok: false, datos: {} };
  }
  const datos = await res.json().catch(() => ({}));
  return { ok: res.ok, datos };
}

function mensajeDe(datos) {
  if (datos.error === "network") return "No pudimos conectarnos. Revisa tu internet.";
  return MENSAJES[datos.error] || GENERICO;
}

function aviso(texto, tipo = "ok") {
  const flash = document.getElementById("flash");
  flash.className = "feedback " + tipo;
  flash.textContent = texto;
}

// --- Textos para copiar ----------------------------------------------------

function mensajeParaLaPareja(boda) {
  return (
    `Hola ${boda.names}! Aquí puedes ver quién confirmó y manejar tu lista de invitados:\n` +
    `${window.location.origin}/login\n` +
    `Tu código: ${boda.access_code}`
  );
}

// Solo el nombre del sitio (sin https), tal como lo pide la lista de Turnstile en Cloudflare.
function direccionParaTurnstile(boda) {
  try {
    return new URL(boda.allowed_origin).hostname;
  } catch {
    return "";
  }
}

function configuracionDeLaInvitacion(inviteId) {
  return (
    `lookupUrl: '${window.location.origin}/api/guest-lookup',\n` +
    `rsvpUrl: '${window.location.origin}/api/rsvp',\n` +
    `inviteId: '${inviteId}'`
  );
}

async function copiar(texto, queCopio) {
  try {
    await navigator.clipboard.writeText(texto);
    aviso(`Copiado: ${queCopio}.`);
  } catch {
    // Si el navegador no deja copiar solo, se muestra el texto para copiarlo a mano.
    await mostrarTexto(`Copia ${queCopio}`, texto);
  }
}

// --- Dibujar la lista ------------------------------------------------------

function boton(texto, clases, alHacerClic) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-small " + clases;
  b.textContent = texto;
  b.addEventListener("click", alHacerClic);
  return b;
}

function texto(etiqueta, clase, contenido) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  el.textContent = contenido;
  return el;
}

// "2026-12-12T16:00" -> "sábado, 12 de diciembre de 2026, 16:00"
function fechaLinda(texto) {
  const [f, h] = texto.split("T");
  const [a, m, d] = f.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  const fecha = new Date(a, m - 1, d, hh, mm);
  return (
    fecha.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
    ", " +
    fecha.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
  );
}

function tarjeta(boda) {
  const caja = document.createElement("article");
  caja.className = "wedding";

  caja.appendChild(texto("h3", "", boda.names));

  const direccion = document.createElement("p");
  direccion.className = "meta";
  const enlace = document.createElement("a");
  enlace.href = boda.allowed_origin;
  enlace.target = "_blank";
  enlace.rel = "noopener";
  enlace.textContent = boda.allowed_origin;
  direccion.append(enlace, document.createTextNode(` · nombre corto: ${boda.invite_id}`));
  caja.appendChild(direccion);

  if (boda.wedding_date) caja.appendChild(texto("p", "meta", "Fecha de la boda: " + fechaLinda(boda.wedding_date)));

  caja.appendChild(
    texto(
      "p",
      "stats",
      boda.guests === 0
        ? "Sin invitados todavía."
        : `${boda.guests} invitados · ${boda.confirmed} confirmaron · ${boda.declined} no vienen · ${boda.pending} sin responder · ${boda.people} personas`
    )
  );

  const linea = document.createElement("p");
  linea.className = "code-line";
  linea.append(document.createTextNode("Código de la pareja: "), texto("span", "code", boda.access_code));
  caja.appendChild(linea);

  const botones = document.createElement("div");
  botones.className = "buttons";

  const administrar = document.createElement("a");
  administrar.className = "btn-small";
  administrar.href = "/dashboard?c=" + encodeURIComponent(boda.invite_id);
  administrar.textContent = "Administrar invitados";
  botones.appendChild(administrar);

  botones.appendChild(
    boton("Copiar mensaje para la pareja", "btn-ghost", () =>
      copiar(mensajeParaLaPareja(boda), "mensaje para la pareja")
    )
  );
  botones.appendChild(
    boton("Copiar datos de la invitación", "btn-ghost", () =>
      copiar(configuracionDeLaInvitacion(boda.invite_id), "datos para invite.js")
    )
  );
  if (direccionParaTurnstile(boda)) {
    botones.appendChild(
      boton("Copiar dirección para Turnstile", "btn-ghost", () =>
        copiar(direccionParaTurnstile(boda), "dirección para Turnstile")
      )
    );
  }
  botones.appendChild(boton("Editar", "btn-ghost", () => abrirEdicion(boda)));
  botones.appendChild(boton("Código nuevo", "btn-ghost", () => codigoNuevo(boda)));
  botones.appendChild(boton("Eliminar", "btn-danger", () => eliminar(boda)));
  caja.appendChild(botones);

  return caja;
}

async function cargar() {
  const { ok, datos } = await pedir("/api/admin/couples");
  if (!ok) return;
  bodas = datos.couples;
  document.getElementById("weddings").replaceChildren(...bodas.map(tarjeta));
  document.getElementById("empty").hidden = bodas.length !== 0;
}

// --- Crear -----------------------------------------------------------------

document.getElementById("new-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("new-feedback");
  const resultado = document.getElementById("new-result");
  const crear = event.target.querySelector("button[type=submit]");
  error.textContent = "";
  resultado.hidden = true;

  crear.disabled = true;
  const { ok, datos } = await pedir("/api/admin/couples", "POST", {
    names: document.getElementById("new-names").value,
    allowed_origin: document.getElementById("new-origin").value,
    invite_id: document.getElementById("new-id").value,
    wedding_date: document.getElementById("new-date").value,
  });
  crear.disabled = false;

  if (!ok) {
    error.textContent = mensajeDe(datos);
    return;
  }

  event.target.reset();
  mostrarResultado(datos);
  if (datos.date_error) error.textContent = "La boda se creó, pero no se guardó la fecha. " + mensajeDe({ error: datos.date_error });
  cargar();
});

function mostrarResultado(boda) {
  const caja = document.getElementById("new-result");
  caja.replaceChildren();

  caja.appendChild(texto("p", "", `Listo, se creó la boda de ${boda.names}.`));

  const codigo = document.createElement("p");
  codigo.append(document.createTextNode("Su código de acceso: "), texto("span", "code", boda.access_code));
  caja.appendChild(codigo);

  caja.appendChild(texto("p", "", "En el archivo invite.js de su invitación, deja estas tres líneas:"));
  caja.appendChild(texto("pre", "snippet", configuracionDeLaInvitacion(boda.invite_id)));

  // Sin este paso la verificación anti-spam no arranca en esa invitación y nadie podría confirmar.
  const host = direccionParaTurnstile(boda);
  if (host) {
    caja.appendChild(
      texto(
        "p",
        "",
        "Un paso más, en Cloudflare: agrega esta dirección a la lista de Turnstile (Turnstile → tu widget → " +
          "Hostname Management → Add hostname). Sin esto, nadie podrá confirmar en esa invitación:"
      )
    );
    caja.appendChild(texto("pre", "snippet", host));
  }

  const botones = document.createElement("div");
  botones.className = "buttons";
  botones.style.display = "flex";
  botones.style.gap = "8px";
  botones.style.flexWrap = "wrap";

  const administrar = document.createElement("a");
  administrar.className = "btn-small";
  administrar.href = "/dashboard?c=" + encodeURIComponent(boda.invite_id);
  administrar.textContent = "Agregar invitados";
  botones.appendChild(administrar);
  botones.appendChild(
    boton("Copiar las tres líneas", "btn-ghost", () =>
      copiar(configuracionDeLaInvitacion(boda.invite_id), "datos para invite.js")
    )
  );
  if (host) {
    botones.appendChild(boton("Copiar dirección para Turnstile", "btn-ghost", () => copiar(host, "dirección para Turnstile")));
  }
  botones.appendChild(
    boton("Copiar mensaje para la pareja", "btn-ghost", () =>
      copiar(mensajeParaLaPareja(boda), "mensaje para la pareja")
    )
  );
  caja.appendChild(botones);
  caja.hidden = false;
}

// --- Editar ----------------------------------------------------------------

const dialogo = document.getElementById("edit-dialog");
let editando = null;

function abrirEdicion(boda) {
  editando = boda;
  document.getElementById("edit-names").value = boda.names;
  document.getElementById("edit-origin").value = boda.allowed_origin;
  document.getElementById("edit-date").value = boda.wedding_date || "";
  document.getElementById("edit-feedback").textContent = "";
  dialogo.showModal();
}

document.getElementById("edit-cancel").addEventListener("click", () => dialogo.close());

document.getElementById("edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editando) return;
  const error = document.getElementById("edit-feedback");
  const guardar = event.target.querySelector("button[type=submit]");

  guardar.disabled = true;
  const { ok, datos } = await pedir(`/api/admin/couples/${encodeURIComponent(editando.invite_id)}`, "PUT", {
    names: document.getElementById("edit-names").value,
    allowed_origin: document.getElementById("edit-origin").value,
    wedding_date: document.getElementById("edit-date").value,
  });
  guardar.disabled = false;

  if (!ok) {
    error.textContent = mensajeDe(datos);
    return;
  }
  dialogo.close();
  // Si cambió la dirección de la invitación, la lista de Turnstile también hay que ponerla al día.
  const cambioDireccion = datos.allowed_origin !== editando.allowed_origin;
  const host = direccionParaTurnstile(datos);
  aviso(
    cambioDireccion && host
      ? `Cambios guardados. La dirección cambió: agrega ${host} a la lista de Turnstile en Cloudflare ` +
          "(Turnstile → tu widget → Hostname Management), o la invitación no podrá confirmar."
      : "Cambios guardados."
  );
  cargar();
});

// --- Código nuevo y eliminar -------------------------------------------------

async function codigoNuevo(boda) {
  const seguro = await confirmar({
    titulo: `Código nuevo para ${boda.names}`,
    mensaje: "El código anterior deja de funcionar y tendrás que enviarles el nuevo.",
    confirmar: "Crear código nuevo",
  });
  if (!seguro) return;

  const { ok, datos } = await pedir(`/api/admin/couples/${encodeURIComponent(boda.invite_id)}`, "PUT", {
    regenerate_code: true,
  });
  if (!ok) return aviso(mensajeDe(datos), "bad");
  aviso(`Código nuevo para ${boda.names}: ${datos.access_code}`);
  cargar();
}

async function eliminar(boda) {
  const detalle =
    boda.guests > 0 ? ` Se borran también sus ${boda.guests} invitados y todas sus respuestas.` : "";
  const seguro = await confirmar({
    titulo: `Eliminar la boda de ${boda.names}`,
    mensaje: `${detalle} Esto no se puede deshacer.`.trim(),
    escribir: "ELIMINAR",
    confirmar: "Eliminar boda",
    peligro: true,
  });
  if (!seguro) return;

  const { ok, datos } = await pedir(`/api/admin/couples/${encodeURIComponent(boda.invite_id)}`, "DELETE");
  if (!ok) return aviso(mensajeDe(datos), "bad");
  aviso(`Se eliminó la boda de ${boda.names}.`);
  cargar();
}

// --- Resto -----------------------------------------------------------------

document.getElementById("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});

cargar();
