// Manda el código a /api/login. Si es correcto, abre el panel.

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error");
const codeInput = document.getElementById("code");
const toggleBtn = document.getElementById("toggle-code");

// El botón del ojo muestra u oculta el código mientras se escribe.
toggleBtn.addEventListener("click", () => {
  const visible = codeInput.type === "password";
  codeInput.type = visible ? "text" : "password";
  toggleBtn.classList.toggle("on", visible);
  toggleBtn.setAttribute("aria-pressed", String(visible));
  const texto = visible ? "Ocultar el código" : "Mostrar el código";
  toggleBtn.setAttribute("aria-label", texto);
  toggleBtn.title = texto;
  codeInput.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  const code = document.getElementById("code").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      // El administrador va a su página; las parejas, a su panel.
      window.location.href = body.role === "admin" ? "/admin" : "/dashboard";
      return;
    }
    if (res.status === 429) {
      errorBox.textContent = "Demasiados intentos con un código equivocado. Espera unos 15 minutos e inténtalo de nuevo.";
    } else if (res.status === 401) {
      errorBox.textContent = "Ese código no es correcto. Revísalo e inténtalo de nuevo.";
    } else if (body.error === "missing_secret") {
      errorBox.textContent = "El código es correcto, pero falta configurar SESSION_SECRET en Cloudflare.";
    } else if (body.error === "session_error") {
      errorBox.textContent = "El código es correcto, pero no se pudo iniciar la sesión (error del servidor).";
    } else {
      errorBox.textContent = "Algo salió mal. Inténtalo otra vez en un momento.";
    }
  } catch {
    errorBox.textContent = "No pudimos conectarnos. Revisa tu internet.";
  }
  errorBox.hidden = false;
});
