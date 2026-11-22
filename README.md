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

### 3. Crear los secretos en Cloudflare

Son dos textos privados. Se guardan en **Workers y Pages**, tu proyecto, **Settings**,
**Variables and Secrets**, en el ambiente **Production**, como variables de tipo **Secret**:

- `SESSION_SECRET`: un texto largo y al azar con el que se firman las cookies (40 caracteres o más).
- `ADMIN_CODE`: tu clave de administrador (ver abajo).
- `TURNSTILE_SECRET`: la clave SECRETA del widget de Cloudflare Turnstile (la verificación anti-spam, ver más abajo).

Genera el primero con un administrador de contraseñas o con `openssl rand -hex 32`.
Cloudflare no vuelve a mostrar el valor de un secreto, así que guárdalos también en tu administrador
de contraseñas. No los subas a GitHub ni los compartas.

Los secretos solo llegan a los despliegues que se hacen **después** de guardarlos: haz un despliegue
nuevo (**Deployments**, el último, **Retry deployment**) y espera a que diga Success.

### 4. Publicar

Cloudflare publica solo cada vez que subes algo a GitHub. Si cambiaste un secreto,
haz un nuevo despliegue para que lo tome.

## Tu clave de administrador

Es el secreto `ADMIN_CODE` de Cloudflare (paso 3). Con ella entras en `/login` y llegas a `/admin`.
Reglas: mínimo 12 caracteres, solo minúsculas y números (el login pasa lo que escribes a minúsculas),
por ejemplo varias palabras sueltas unidas con guiones. Guárdala en tu administrador de contraseñas.

Para cambiarla: edita el secreto `ADMIN_CODE` en Cloudflare y haz un despliegue nuevo.
Dura 1 día de sesión; después se vuelve a escribir.

Si todavía no existe la variable `ADMIN_CODE`, el sitio usa como respaldo el ajuste `admin_code`
de la tabla `settings` (que crea `schema.sql`). Una vez que `ADMIN_CODE` funciona, esas copias de la
base de datos se pueden borrar:

```
DELETE FROM settings WHERE key IN ('session_secret', 'admin_code');
```

## Crear una boda nueva

1. Entra en `/login` con tu clave de administrador.
2. En **Nueva boda** escribe los nombres de la pareja y la dirección de su invitación
   (por ejemplo `https://juancarla.pages.dev`). El código de la pareja y el nombre corto se crean solos.
3. Al crearla aparecen tres líneas (`lookupUrl`, `rsvpUrl` e `inviteId`). Pégalas en el `invite.js`
   de su invitación (el resto de los pasos para armar la invitación está en el README de la plantilla,
   `Muestra-3-Invitacion`).
4. **Agregar invitados** te lleva a su lista. Ahí los agregas tú o se lo dejas a la pareja.
5. **Copiar mensaje para la pareja** te deja listo el texto con el enlace y su código para enviarlo.

La dirección de la invitación debe ser exactamente la misma que la del sitio publicado
(https, sin ruta). Si pegas un enlace con ruta o con una barra al final, se limpia solo.

## Los invitados

Los agrega la pareja (o tú) desde el panel, sin tocar la base de datos:

- **Agregar invitado:** nombre y apellido, pases (1 a 10) y celular completo (de 7 a 15 dígitos; se
  aceptan espacios, guiones y el +). El invitado lo escribe para confirmar, así que debe ser su número.
- **Agregar varios a la vez:** una línea por invitado (`Juan Pérez, 2, 71234567`). Se puede pegar directo
  desde Excel o Google Sheets. Los que tengan algún problema se quedan en el cuadro con la explicación,
  para corregirlos y volver a enviar.
- **Editar:** corrige el nombre, los pases o el celular. No deja bajar los pases por debajo de lo que ya
  confirmó.
- **Eliminar:** borra al invitado y, si ya había respondido, también su respuesta.

Reglas: hace falta nombre y apellido (la invitación busca por los dos). Las tildes y las mayúsculas no
importan («Juan Perez» es lo mismo que «Juan Pérez»), y por eso no puede haber dos invitados con el mismo
nombre en una boda: si dos personas se llaman igual, agrega un apellido o una inicial a una de ellas.
Para encontrarse basta con escribir el comienzo de cada palabra («Luis Quis» encuentra a «Luis Quispe»), pero
con al menos dos palabras de 3 letras o más; así nadie puede sacar nombres probando letras sueltas.

## Actualizar una base de datos que ya existe

Los cambios de la base de datos están en `migrations/`. Se corren una sola vez, en orden,
**antes** de publicar el código que los usa:

```
npx wrangler d1 execute jotapg-db --remote --file=migrations/001-invitados.sql
npx wrangler d1 execute jotapg-db --remote --file=migrations/002-administrador.sql
npx wrangler d1 execute jotapg-db --remote --file=migrations/003-celular-completo.sql
npx wrangler d1 execute jotapg-db --remote --file=migrations/004-fecha-de-la-boda.sql
npx wrangler d1 execute jotapg-db --remote --file=migrations/005-bloqueo-por-intentos.sql
```

- La `001` crea la lista de invitados y carga los de la muestra (`muestra-3`).
- La `002` crea tu clave de administrador.
- La `003` cambia los últimos 4 dígitos del celular por el número completo.
- La `004` agrega la fecha de la boda, que se escribe en /admin y alimenta la cuenta regresiva del panel.
- La `005` crea la tabla del bloqueo por celulares equivocados (anti-spam).

También se pueden pegar en la consola de `jotapg-db` en Cloudflare, una por una.

## Si prefieres usar la terminal

Todo lo de arriba también se puede hacer con SQL. Por ejemplo, una pareja:

```
npx wrangler d1 execute jotapg-db --remote --command "INSERT INTO couples (invite_id, names, allowed_origin, access_code) VALUES ('prueba', 'Pareja de prueba', 'https://prueba.pages.dev', lower(hex(randomblob(8))))"
```

y sus invitados:

```
npx wrangler d1 execute jotapg-db --remote --command "INSERT INTO guests (invite_id, name, passes, phone) VALUES ('prueba', 'Juan Pérez', 2, '71234567')"
```

## Probar que todo funciona

1. Abre la invitación de prueba, busca un invitado de la lista y confirma con su número de celular.
2. Abre `jotapg.pages.dev/login` y escribe el código de la pareja de prueba (o tu clave de administrador y entra a su boda).
3. En el panel, el invitado debe aparecer como confirmó (o no viene) y los números de arriba deben cambiar.
4. Agrega, edita y borra un invitado desde el panel.
5. Cuando termines, borra el invitado de prueba desde el panel.

## Cosas a tener en cuenta

- El código de acceso funciona como una contraseña: quien lo tenga ve y maneja la lista de esa pareja.
  Se envía en privado a cada pareja. Si se filtra, en `/admin` usa **Código nuevo**: el anterior deja de servir.
- Tu clave de administrador da acceso a todas las bodas: no la compartas.
- La sesión de las parejas dura 7 días; la tuya, 1 día.
- Cada pareja solo puede tocar su propia boda, aunque alguien cambie la dirección del navegador.
- Al confirmar, la API revisa el celular completo y que los pases no pasen de los del invitado. El número vale
  con o sin el código de país («71234567» es lo mismo que «59171234567»), pero los dígitos que sobran delante
  tienen que ser un código de país de verdad: escribir solo el final del número o inventar dígitos no sirve.
  Si el mismo invitado vuelve a confirmar, su respuesta nueva reemplaza a la anterior.

## Protección contra spam

Dos protecciones en la confirmación de asistencia (`/api/rsvp`):

- **Turnstile (Cloudflare):** la invitación muestra una verificación casi invisible y manda su resultado al
  confirmar; JotaPG le pregunta a Cloudflare si es verdadero (`lib/turnstile.js`). La clave PÚBLICA del widget va
  en el `invite.js` de cada invitación (`turnstileSiteKey`, es la misma para todas) y la clave SECRETA es el secreto
  `TURNSTILE_SECRET` de Cloudflare. Si ese secreto no existe, no se exige nada.
  El widget solo funciona en las direcciones que tenga en su lista de hostnames: **cada invitación nueva
  hay que agregarla ahí** (Cloudflare, Turnstile, el widget, Hostname Management). El plan gratis permite
  10 por widget y 20 widgets.
- **Bloqueo:** tras 5 celulares equivocados para un mismo invitado, ese invitado queda bloqueado 15 minutos
  (`lib/attempts.js`, tabla `rsvp_attempts`, migración 005). Una confirmación correcta borra los intentos.

La búsqueda de nombre (`/api/guest-lookup`) todavía no exige Turnstile: se pregunta en cada pausa al escribir
y el token sirve una sola vez. Lo que sí hace es exigir dos palabras de 3 letras o más y no devolver nunca el
celular. Un límite de pedidos por dirección queda pendiente para más adelante.
