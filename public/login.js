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
    errorBox.textContent = res.status === 401
      ? "Ese código no es correcto. Revísalo e inténtalo de nuevo."
      : "Algo salió mal. Inténtalo otra vez en un momento.";
  } catch {
    errorBox.textContent = "No pudimos conectarnos. Revisa tu internet.";
  }
  errorBox.hidden = false;
});
