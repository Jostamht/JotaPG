# .JotaPG

Invitaciones web de boda con confirmación de asistencia en línea.

Cada pareja tiene su propio sitio de invitación. Cuando un invitado confirma, la respuesta
llega a JotaPG y se guarda en una base de datos. La pareja entra a su panel con un código
y ve solo sus respuestas.

## Cómo funciona

- **Base de datos:** tres listas, `couples` (las parejas), `guests` (los invitados de cada pareja) y `rsvps` (las respuestas).
- **API (la recepción):** `functions/api/`. Recibe pedidos, los revisa y lee o escribe en la base de datos.
- **Lista de invitados:** vive en la base de datos, no en la página de la invitación. El formulario le pregunta
  a la API quién es el invitado y la API revisa el celular y los pases al confirmar. Nadie puede ver la lista completa.
- **Login:** la pareja escribe su código en `/login`. Si existe, recibe una cookie firmada que dice quién es.
- **Panel:** `/dashboard` muestra todos los invitados de la pareja que entró, cada uno como
  sin responder, confirmó o no viene. Desde ahí la pareja agrega (uno o varios a la vez), edita y borra
  sus invitados.
- **Administración:** `/admin` es solo para ti. Entras en `/login` con tu clave de administrador y ves todas
  las bodas: creas una nueva, entras a manejar sus invitados, copias el mensaje para la pareja, creas un
  código nuevo o la borras. No hace falta tocar la base de datos para el trabajo de todos los días.

## Qué hay aquí

```
public/                 Lo que se ve en el navegador
  index.html            Página principal
  login.html / .js      Entrada con código
  dashboard.html / .js  Panel de la pareja (también lo abre el administrador, con ?c=)
  admin.html / .js      Página del administrador: todas las bodas
  style.css             Colores y tipografías
functions/api/          La recepción (código que corre en Cloudflare)
  login.js              Revisa el código y da la cookie
  logout.js             Cierra la sesión
  rsvps.js              Devuelve los invitados de la pareja con su estado
  rsvp.js               Recibe la confirmación de un invitado (la usan las invitaciones)
  guest-lookup.js       Busca a un invitado por su nombre (la usan las invitaciones)
  guests/               Agregar, editar y borrar invitados (panel de la pareja y del administrador)
  admin/couples/        Crear, editar y borrar bodas (solo administrador)
  test-rsvp.js          SOLO PRUEBAS: crea una respuesta falsa
lib/session.js          Crea y revisa la cookie de sesión (pareja o administrador)
lib/auth.js             Decide quién pide algo y de qué boda se trata
lib/invite-api.js       Lo que comparten rsvp.js y guest-lookup.js (permisos y búsqueda por nombre)
lib/guests.js           Reglas de los invitados (nombre y apellido, pases, celular, sin repetidos)
lib/couples.js          Códigos de acceso, nombres cortos y direcciones de las bodas
schema.sql              Las listas de la base de datos (para empezar de cero)
migrations/             Cambios para una base de datos que ya existe
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

### 2. Crear las listas

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

## Tu clave de administrador

Se crea sola al correr `schema.sql` (o la migración 002, si la base de datos ya existía). Para verla,
en la consola de `jotapg-db`:

```
SELECT value FROM settings WHERE key = 'admin_code';
```

Guárdala en un lugar seguro. Con ella entras en `/login` y llegas a `/admin`. Si prefieres una propia
(mínimo 12 caracteres):

```
UPDATE settings SET value = 'tu-clave-larga-aqui' WHERE key = 'admin_code';
```

Dura 1 día de sesión; después se vuelve a escribir.

## Crear una boda nueva

1. Entra en `/login` con tu clave de administrador.
2. En **Nueva boda** escribe los nombres de la pareja y la dirección de su invitación
   (por ejemplo `https://juancarla.pages.dev`). El código de la pareja y el nombre corto se crean solos.
3. Al crearla aparecen tres líneas (`lookupUrl`, `rsvpUrl` e `inviteId`). Pégalas en el `invite.js`
   de su invitación.
4. **Agregar invitados** te lleva a su lista. Ahí los agregas tú o se lo dejas a la pareja.
5. **Copiar mensaje para la pareja** te deja listo el texto con el enlace y su código para enviarlo.

La dirección de la invitación debe ser exactamente la misma que la del sitio publicado
(https, sin ruta). Si pegas un enlace con ruta o con una barra al final, se limpia solo.

## Los invitados

Los agrega la pareja (o tú) desde el panel, sin tocar la base de datos:

- **Agregar invitado:** nombre y apellido, pases (1 a 10) y últimos 4 dígitos del celular.
  Si pegas el número completo, se queda con los últimos 4.
- **Agregar varios a la vez:** una línea por invitado (`Juan Pérez, 2, 1234`). Se puede pegar directo
  desde Excel o Google Sheets. Los que tengan algún problema se quedan en el cuadro con la explicación,
  para corregirlos y volver a enviar.
- **Editar:** corrige el nombre, los pases o el celular. No deja bajar los pases por debajo de lo que ya
  confirmó.
- **Eliminar:** borra al invitado y, si ya había respondido, también su respuesta.

Reglas: hace falta nombre y apellido (la invitación busca por los dos). Las tildes y las mayúsculas no
importan («Juan Perez» es lo mismo que «Juan Pérez»), y por eso no puede haber dos invitados con el mismo
nombre en una boda: si dos personas se llaman igual, agrega un apellido o una inicial a una de ellas.

## Actualizar una base de datos que ya existe

Los cambios de la base de datos están en `migrations/`. Se corren una sola vez, en orden,
**antes** de publicar el código que los usa:

```
npx wrangler d1 execute jotapg-db --remote --file=migrations/001-invitados.sql
npx wrangler d1 execute jotapg-db --remote --file=migrations/002-administrador.sql
```

- La `001` crea la lista de invitados y carga los de la muestra (`muestra-3`).
- La `002` crea tu clave de administrador.

También se pueden pegar en la consola de `jotapg-db` en Cloudflare, una por una.

## Si prefieres usar la terminal

Todo lo de arriba también se puede hacer con SQL. Por ejemplo, una pareja:

```
npx wrangler d1 execute jotapg-db --remote --command "INSERT INTO couples (invite_id, names, allowed_origin, access_code) VALUES ('prueba', 'Pareja de prueba', 'https://prueba.pages.dev', lower(hex(randomblob(8))))"
```

y sus invitados:

```
npx wrangler d1 execute jotapg-db --remote --command "INSERT INTO guests (invite_id, name, passes, phone_last4) VALUES ('prueba', 'Juan Pérez', 2, '1234')"
```

## Probar que todo funciona

1. Abre la invitación de prueba, busca un invitado de la lista y confirma con los últimos 4 dígitos de su celular.
2. Abre `jotapg.pages.dev/login` y escribe el código de la pareja de prueba (o tu clave de administrador y entra a su boda).
3. En el panel, el invitado debe aparecer como confirmó (o no viene) y los números de arriba deben cambiar.
4. Agrega, edita y borra un invitado desde el panel.
5. Si quieres ver respuestas sueltas, presiona **Crear respuesta de prueba**: salen en «Otras respuestas».

Cuando termines de probar, borra `functions/api/test-rsvp.js` y el bloque
"Modo de prueba" de `public/dashboard.html`.

## Cosas a tener en cuenta

- El código de acceso funciona como una contraseña: quien lo tenga ve y maneja la lista de esa pareja.
  Se envía en privado a cada pareja. Si se filtra, en `/admin` usa **Código nuevo**: el anterior deja de servir.
- Tu clave de administrador da acceso a todas las bodas: no la compartas.
- La sesión de las parejas dura 7 días; la tuya, 1 día.
- Cada pareja solo puede tocar su propia boda, aunque alguien cambie la dirección del navegador.
- Al confirmar, la API revisa los últimos 4 dígitos del celular y que los pases no pasen de los del invitado.
  Si el mismo invitado vuelve a confirmar, su respuesta nueva reemplaza a la anterior.
- Todavía falta el captcha (Turnstile) para evitar que alguien pruebe celulares al azar
  antes de usarlo con parejas reales.
