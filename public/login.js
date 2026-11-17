// Manda el código a /api/login. Si es correcto, abre el panel.

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error");

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

    if (res.ok) {
      window.location.href = "/dashboard";
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
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
