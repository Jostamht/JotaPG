// Modo claro / oscuro. Se carga en el <head> para pintar el tema correcto desde el primer momento.
// Si la persona nunca eligió, se usa el del aparato; si eligió, se recuerda en este navegador.
(function () {
  var raiz = document.documentElement;
  var CLAVE = "jp-tema";

  function guardado() {
    try {
      var t = localStorage.getItem(CLAVE);
      return t === "dark" || t === "light" ? t : null;
    } catch (e) {
      return null;
    }
  }
  function delSistema() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function poner(tema) {
    raiz.setAttribute("data-theme", tema);
  }

  poner(guardado() || delSistema());

  // Si no eligió nada y el aparato cambia de tema, se acompaña.
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var alCambiar = function () {
      if (!guardado()) poner(delSistema());
    };
    if (mq.addEventListener) mq.addEventListener("change", alCambiar);
  }

  var SOL =
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  var LUNA =
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  document.addEventListener("DOMContentLoaded", function () {
    var encabezado = document.querySelector(".header");
    if (!encabezado) return;

    // El botón va junto a lo que ya hay a la derecha (Entrar / Salir).
    var acciones = document.createElement("div");
    acciones.className = "header-actions";
    Array.prototype.slice
      .call(encabezado.children)
      .filter(function (el) {
        return !el.classList.contains("logo");
      })
      .forEach(function (el) {
        acciones.appendChild(el);
      });

    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = "theme-toggle";
    boton.innerHTML = SOL + LUNA;

    function etiqueta() {
      var oscuro = raiz.getAttribute("data-theme") === "dark";
      var texto = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
      boton.setAttribute("aria-label", texto);
      boton.title = texto;
    }
    etiqueta();

    boton.addEventListener("click", function () {
      var nuevo = raiz.getAttribute("data-theme") === "dark" ? "light" : "dark";
      // Los colores se mezclan en vez de cambiar de golpe (solo durante el cambio).
      raiz.classList.add("theme-fade");
      poner(nuevo);
      clearTimeout(boton._fade);
      boton._fade = setTimeout(function () {
        raiz.classList.remove("theme-fade");
      }, 600);
      try {
        localStorage.setItem(CLAVE, nuevo);
      } catch (e) {
        // Sin almacenamiento el cambio funciona igual, solo no se recuerda.
      }
      etiqueta();
    });

    acciones.insertBefore(boton, acciones.firstChild);
    encabezado.appendChild(acciones);
  });
})();
