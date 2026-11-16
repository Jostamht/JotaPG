# .JotaPG

Invitaciones web de boda con confirmación de asistencia en línea.

Este repositorio es el sitio de JotaPG. Por ahora es una página sencilla; más adelante
aquí vivirá también el panel donde cada pareja ve las confirmaciones de sus invitados.

## Qué hay aquí

```
public/
  index.html   La página (el texto está en español, fácil de cambiar)
  style.css    Colores, tipografías y espacios
README.md      Este archivo
```

Todo lo que se ve en el sitio está dentro de la carpeta `public`.

## Cómo cambiar cosas

- **El texto:** abrir `public/index.html` y editar lo que está entre las etiquetas.
- **Los colores:** arriba de `public/style.css`, en el bloque `:root`.
- **Las tipografías:** Manrope para el logo y Plus Jakarta Sans para el resto.

## Cómo verlo en mi computadora

Abrir `public/index.html` con el navegador. No hace falta instalar nada.

## Cómo publicarlo en Cloudflare Pages

1. Entrar a Cloudflare, ir a **Workers y Pages** y crear un proyecto **Pages**.
2. Conectar este repositorio de GitHub.
3. Configurar:
   - **Comando de build:** dejarlo vacío.
   - **Directorio de salida:** `public`.
4. Guardar y desplegar. El sitio queda en `jotapg.pages.dev`.

Cada vez que se sube un cambio a GitHub, Cloudflare lo publica solo.

## Lo que sigue

1. Base de datos y recepción de confirmaciones.
2. Invitación de prueba.
3. Panel para las parejas, con login.
