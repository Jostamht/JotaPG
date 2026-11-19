// Cuadros de diálogo propios del sitio, en lugar de los del navegador (confirm, alert, prompt).
// Se usan así:
//   if (await confirmar({ titulo: "Eliminar a Ana", mensaje: "...", confirmar: "Eliminar", peligro: true })) { ... }
//   await avisar("No se pudo eliminar", "Inténtalo otra vez.");
//   await mostrarTexto("Copia este texto", texto);
// Opciones de confirmar: titulo, mensaje, confirmar (texto del botón), cancelar,
//   peligro (botón rojo), escribir (una palabra que hay que escribir para poder confirmar).

let caja = null;

function elemento(etiqueta, atributos = {}, texto) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) el.setAttribute(clave, valor);
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function crearCaja() {
  if (caja) return caja;

  caja = elemento("dialog", {
    id: "jp-dialog",
    "aria-labelledby": "jp-dialog-title",
    "aria-describedby": "jp-dialog-msg",
  });

  const form = elemento("form", { method: "dialog", class: "stack" });
  form.append(
    elemento("h2", { id: "jp-dialog-title" }),
    elemento("p", { id: "jp-dialog-msg", class: "dialog-msg" }),
    (() => {
      const etiqueta = elemento("label", { id: "jp-dialog-field" });
      etiqueta.append(
        elemento("span", { id: "jp-dialog-field-label" }),
        elemento("input", { id: "jp-dialog-input", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" })
      );
      return etiqueta;
    })(),
    elemento("textarea", { id: "jp-dialog-text", readonly: "", rows: "4" }),
    (() => {
      const acciones = elemento("div", { class: "dialog-actions" });
      acciones.append(
        elemento("button", { id: "jp-dialog-cancel", type: "button", class: "btn-ghost" }),
        elemento("button", { id: "jp-dialog-ok", type: "submit", value: "ok" })
      );
      return acciones;
    })()
  );
  caja.appendChild(form);
  document.body.appendChild(caja);

  // Un clic fuera de la ventana (en lo oscuro) la cierra, igual que Escape.
  caja.addEventListener("click", (evento) => {
    const r = caja.getBoundingClientRect();
    const fuera =
      evento.clientX < r.left || evento.clientX > r.right || evento.clientY < r.top || evento.clientY > r.bottom;
    if (fuera) caja.close("cancel");
  });
  caja.querySelector("#jp-dialog-cancel").addEventListener("click", () => caja.close("cancel"));
  return caja;
}

function abrir(opciones) {
  const d = crearCaja();
  const q = (id) => d.querySelector("#" + id);
  const titulo = q("jp-dialog-title");
  const mensaje = q("jp-dialog-msg");
  const campo = q("jp-dialog-field");
  const entrada = q("jp-dialog-input");
  const texto = q("jp-dialog-text");
  const cancelar = q("jp-dialog-cancel");
  const aceptar = q("jp-dialog-ok");
  const palabra = opciones.escribir ? String(opciones.escribir).toUpperCase() : "";

  titulo.textContent = opciones.titulo || "";
  mensaje.textContent = opciones.mensaje || "";
  mensaje.hidden = !opciones.mensaje;

  campo.hidden = !palabra;
  q("jp-dialog-field-label").textContent = palabra ? `Para confirmar, escribe ${palabra}` : "";
  entrada.value = "";

  texto.hidden = opciones.texto === undefined;
  texto.value = opciones.texto || "";

  cancelar.hidden = !!opciones.soloAceptar;
  cancelar.textContent = opciones.cancelar || "Cancelar";
  aceptar.textContent = opciones.confirmar || "Aceptar";
  aceptar.className = opciones.peligro ? "btn-danger-solid" : "";

  const palabraCorrecta = () => !palabra || entrada.value.trim().toUpperCase() === palabra;
  aceptar.disabled = !palabraCorrecta();

  return new Promise((resolver) => {
    const control = new AbortController();
    const { signal } = control;

    entrada.addEventListener("input", () => { aceptar.disabled = !palabraCorrecta(); }, { signal });
    d.querySelector("form").addEventListener("submit", (evento) => {
      if (!palabraCorrecta()) evento.preventDefault();
    }, { signal });
    d.addEventListener("close", () => {
      control.abort();
      resolver(d.returnValue === "ok");
    }, { once: true, signal });

    d.returnValue = "";
    d.showModal();

    // Con una acción que borra, el foco empieza en Cancelar para que un Enter sin querer no borre.
    if (palabra) entrada.focus();
    else if (opciones.peligro && !opciones.soloAceptar) cancelar.focus();
    else if (opciones.texto !== undefined) { texto.focus(); texto.select(); }
    else aceptar.focus();
  });
}

function confirmar(opciones) {
  return abrir(opciones);
}

async function avisar(titulo, mensaje) {
  await abrir({ titulo, mensaje, soloAceptar: true });
}

async function mostrarTexto(titulo, texto) {
  await abrir({ titulo, texto, soloAceptar: true, confirmar: "Listo" });
}
