# .JotaPG

Invitaciones web de boda con confirmación de asistencia en línea.

Cada pareja tiene su propio sitio de invitación. Cuando un invitado confirma, la respuesta
llega a JotaPG y se guarda en una base de datos. La pareja entra a su panel con un código
y ve solo sus respuestas.

## Cómo funciona

- **Base de datos:** dos listas, `couples` (las parejas) y `rsvps` (las respuestas).
- **API (la recepción):** `functions/api/`. Recibe pedidos, los revisa y lee o escribe en la base de datos.
- **Login:** la pareja escribe su código en `/login`. Si existe, recibe una cookie firmada que dice quién es.
- **Panel:** `/dashboard` muestra las respuestas de la pareja que entró y de nadie más.

## Qué hay aquí

```
public/                 Lo que se ve en el navegador
  index.html            Página principal
  login.html / .js      Entrada con código
  dashboard.html / .js  Panel de la pareja
  style.css             Colores y tipografías
functions/api/          La recepción (código que corre en Cloudflare)
  login.js              Revisa el código y da la cookie
  logout.js             Cierra la sesión
  rsvps.js              Devuelve las respuestas de la pareja
  rsvp.js               Recibe la confirmación de un invitado (la usarán las invitaciones)
  test-rsvp.js          SOLO PRUEBAS: crea una respuesta falsa
lib/session.js          Crea y revisa la cookie de sesión
schema.sql              Las dos listas de la base de datos
wrangler.toml           Conecta el código con la base de datos
```

## Puesta en marcha (una sola vez)

Los comandos se escriben en una terminal, dentro de la carpeta del proyecto.

### 1. Crear la base de datos

```
npx wrangler d1 create jotapg-db
```

Copia el `database_id` que aparece y pégalo en `wrangler.toml`, en la línea `database_id`.
Sube ese cambio a GitHub. (Ya está puesto el de la base de datos actual.)

### 2. Crear las dos listas

```
npx wrangler d1 execute jotapg-db --remote --file=schema.sql
```

### 3. Crear el secreto de las sesiones

Es un texto largo y privado con el que se firman las cookies. Genera uno:

```
openssl rand -hex 32
```

Hay dos formas de guardarlo; basta con una.

**Opción A: en la base de datos** (no depende de la configuración de Cloudflare). En la consola de `jotapg-db`:

```
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO settings (key, value) VALUES ('session_secret', lower(hex(randomblob(32))));
```

El secreto se crea solo dentro de la base de datos y nadie lo ve.

**Opción B: en Cloudflare.** **Workers y Pages**, tu proyecto, **Settings**, **Variables and Secrets**.
Agrega una variable de tipo **Secret** llamada `SESSION_SECRET` con el texto de arriba.
Si existe, tiene prioridad sobre la opción A.

No subas el secreto a GitHub ni lo compartas.

### 4. Publicar

Cloudflare publica solo cada vez que subes algo a GitHub. Después de agregar el secreto,
haz un nuevo despliegue para que lo tome.

## Agregar una pareja

```
npx wrangler d1 execute jotapg-db --remote --command "INSERT INTO couples (invite_id, names, allowed_origin, access_code) VALUES ('prueba', 'Pareja de prueba', 'https://prueba.pages.dev', lower(hex(randomblob(8))))"
```

Cambia `invite_id`, el nombre y la dirección de su invitación. El código se crea solo.
Para verlo y enviárselo a la pareja:

```
npx wrangler d1 execute jotapg-db --remote --command "SELECT names, access_code FROM couples"
```

## Probar que todo funciona

1. Abre `jotapg.pages.dev/login` y escribe el código de la pareja de prueba.
2. En el panel, presiona **Crear respuesta de prueba** unas cuantas veces.
3. Deben aparecer en la tabla y en los números de arriba.

Cuando termines de probar, borra `functions/api/test-rsvp.js` y el bloque
"Modo de prueba" de `public/dashboard.html`.

## Cosas a tener en cuenta

- El código de acceso funciona como una contraseña: quien lo tenga ve las respuestas de esa pareja.
  Se envía en privado a cada pareja.
- La sesión dura 7 días.
- Todavía falta: la invitación de prueba que conecte con `/api/rsvp`, y el captcha (Turnstile)
  para evitar respuestas falsas antes de usarlo con parejas reales.
