# Plan de persistencia de Cash Control

## Fases

1. **Infraestructura + identidad:** clientes Supabase, proxy, negocios, perfiles,
   membresías, permisos de lectura y PIN privados. Completada y aplicada al cloud.
2. **Fase 2A — identidades Auth y aprovisionamiento backend:** creación de Auth users,
   perfiles/membresías/PIN y bootstrap del primer Owner. 0002 aplicada al cloud.
   **Fase 2B.1 — sesiones de estación y operador:** foundation server-only preparada
   en 0003 y 0003/0004 aplicadas al cloud. **Fase 2B.2:** integración con cookies
   y UX, sin conectar todavía el actor real con el piloto financiero.
3. **Fase 2C.1 — turnos + participantes:** persistir el ciclo operativo y participantes
   sin conectar todavía la UI ni las finanzas.
4. **Caja + bancos + reservas:** recursos y obligaciones por negocio.
5. **Operaciones financieras:** registro transaccional de depósitos/retiros.
6. **Fondos + correcciones + aclaraciones:** mutaciones y trazabilidad.
7. **Corte:** conteo, cierre y reconciliación transaccionales.
8. **Realtime / multiusuario / endurecimiento:** concurrencia, idempotencia,
   sincronización, pruebas de aislamiento y revisión integral de seguridad.

## Estado de Fase 1

UsersContext, MockSessionContext, ShiftContext y BusinessFundsContext siguen
in-memory. Sus datos, PIN, pantallas y cálculos no cambian. Ninguna tabla financiera
se crea. Según el estado remoto comunicado, `0001_identity_and_business.sql`
ya se aplicó al cloud con nombre registrado `identity_and_business`. No se modifica,
renombra ni reaplica desde Codex. También se reporta aplicada `0002_auth_provisioning.sql`
y `0003_workstation_sessions.sql`. Las tres son inmutables; este parche solo prepara
`0004_workstation_fk_indexes.sql` ya está aplicada al cloud. No se ejecutaron
mutaciones Admin, bootstrap ni cambios remotos durante esta fase.

`0005_list_workstation_members.sql` queda preparada localmente para la siguiente
capacidad de lectura de miembros activados; no se aplica al cloud desde Codex.
`0006_shifts_and_participants.sql` queda preparada localmente para persistir turnos
y participantes; tampoco se aplica al cloud desde Codex.

Factories preparados:

- `src/lib/supabase/client.ts`: navegador, clave pública.
- `src/lib/supabase/server.ts`: cookies de Next.js, cliente por petición.
- `src/lib/supabase/admin.ts`: `server-only`, Secret Key, sin persistir sesión,
  sin cookies de usuarios ni reexportaciones compartidas.
- `src/proxy.ts` y `src/lib/supabase/proxy.ts`: convención Next.js 16,
  `getClaims()` y propagación de cookies a request/response, conservando las
  cabeceras anticaché del SDK. No protegen ni redirigen rutas todavía.

Copiar `.env.example` a `.env.local`, ignorado por Git, y completar solo localmente:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

La aplicación prefiere esos nombres actuales. Para instalaciones que todavía
usan los nombres históricos de Supabase también acepta
`NEXT_PUBLIC_SUPABASE_ANON_KEY` como clave pública y
`SUPABASE_SERVICE_ROLE_KEY` como clave exclusivamente de servidor; no se deben
configurar ambas variantes con valores distintos.

No hay clientes creados al importar módulos. Las llamadas explícitas a factories
sin configuración lanzan errores claros. Solo el proxy hace no-op temporal cuando
falta URL o clave pública. En Fase 2 exigir configuración y autorización real;
este no-op NO debe usarse como mecanismo de autenticación. La Secret Key nunca
lleva prefijo NEXT_PUBLIC ni se usa desde Client Components.

La Secret Key (`sb_secret_...`) es la clave backend actual de Supabase. Se guarda
en `SUPABASE_SECRET_KEY` y se usa exclusivamente en código `server-only`.
Sigue utilizando el rol PostgreSQL `service_role`; por eso los GRANT SQL conservan
ese nombre. Cambiar la API key de la aplicación no cambia el rol de la base.

## Esquema y acceso

`0001_identity_and_business.sql` crea `public.businesses`, `public.profiles`,
`public.business_members` y `private.member_pins`. Los perfiles requieren un
`auth.users.id` real. `first_name`, `last_name` y `display_name` son NOT NULL y
exigen `btrim(valor) <> ''`, sin imponer formatos; avatar no cambia.
Username es único por negocio sin distinguir mayúsculas;
no se admiten espacios al inicio/final. No existe un negocio global hardcodeado.

RLS y GRANT/REVOKE conceden a authenticated solo SELECT: negocios/membresías
requieren membresía propia activa y negocio activo. Un perfil es visible a su
propietario o a miembros activos de un negocio activo compartido. Se incluyen
perfiles de compañeros suspendidos para permitir la futura administración de
Usuarios; un suspendido no gana acceso a compañeros por esa membresía.
Anon no tiene permisos sobre las tablas. No hay policies de escritura.

`authenticated` tiene SELECT completo sobre negocios y perfiles. En membresías
solo puede seleccionar `id`, `business_id`, `user_id`, `username`, `role`, `status`,
`created_at`, `updated_at` y `last_login_at`. Las consultas futuras desde el
navegador deben enumerar esas columnas: `select('*')` incluye una columna sin
permiso y será rechazado.

`business_members.internal_notes` es un dato administrativo **Owner-only** y no
es visible mediante `authenticated`, incluso cuando la membresía tiene rol owner.
No debe obtenerse directamente desde Client Components. `service_role` conserva
lectura y escritura sobre todas las columnas de las tablas públicas de identidad.
En la integración futura, una Server Action / Route Handler autorizado resolverá
la operator session, verificará la pertenencia de su userId al negocio con membresía
y negocio activos, comprobará `role = owner` y solo entonces usará el cliente administrativo SERVER-ONLY
para leer/modificar las notas. Ese endpoint no se implementa en esta fase.

Los helpers SECURITY DEFINER viven en `private`, usan `search_path = ''`, tablas
calificadas y el propietario de migraciones confiable (postgres). Solo los tres
helpers de lectura se conceden a authenticated. `private` no aparece en
`supabase/config.toml` como esquema expuesto y **debe permanecer fuera de Exposed
schemas en el proyecto remoto**. USAGE de schema para RLS no concede SELECT sobre
secretos ni los expone por Data API.

## Contraseñas y PIN

Supabase Auth será responsable de las contraseñas. No crear `password_hash`,
`temporary_password`, contraseñas ni PIN en public. `temporaryPassword` es
exclusivamente del prototipo. En Fase 2, el Owner generará/restablecerá contraseñas
mediante Auth Admin desde código SERVER-ONLY, previa autorización del actor.

El PIN es una confirmación operativa secundaria, no sustituye Supabase Auth.
`private.hash_pin` valida 4–6 dígitos y usa bcrypt de pgcrypto con coste 12 y salt
aleatorio. Nunca guardar PIN plano en PostgreSQL ni enviar `pin_hash` al navegador.
La migración ubica pgcrypto en `extensions`; no usa pgsodium.

`private.verify_member_pin` solo retorna boolean y bloquea la fila con FOR UPDATE
para serializar intentos concurrentes. Cinco fallos consecutivos bloquean cinco
minutos; acertar reinicia el contador, y expirar el bloqueo abre otra ventana.
El PIN correcto tampoco permite entrar durante el bloqueo. Membresías o negocios
suspendidos se rechazan. Los helpers PIN solo se conceden a service_role; no hay
acceso directo de esa role a member_pins. Fase 2A añade RPC administrativos públicos
solo para service_role, sin exponer private ni la verificación de PIN al navegador.

En Fase 2B.1 el servicio valida workstation, negocio y activación del destinatario
antes de llamar al wrapper administrativo de PIN. La verificación debe
confirmar su transacción incluso ante PIN incorrecto: un rollback posterior
anularía el contador. No registrar PIN en logs. La creación/rotación del hash
usa las primitivas administrativas de 0002; su futura exposición a la UI requiere
autorización real del actor. No exponer private para resolverlo.

## Fase 2A: aprovisionamiento backend

`0002_auth_provisioning.sql` añade tres funciones con SECURITY DEFINER,
`search_path = ''`, nombres calificados y EXECUTE exclusivamente para service_role
(revocado a PUBLIC, anon y authenticated):

- `admin_provision_member`: verifica Auth user y negocio activo, crea perfil,
  membresía y hash PIN en una sola transacción implícita. No hace upsert de perfiles
  existentes, no devuelve hash y cualquier error revierte las tres inserciones.
- `admin_set_member_pin`: genera nuevo hash mediante private.hash_pin y restablece
  intentos/bloqueo. Requiere un PIN ya aprovisionado y no devuelve secretos.
- `admin_find_member_by_username`: preflight exacto con el mismo lower() del índice
  único, sin comodines de PostgREST ni enumeración de usernames para el navegador.

RLS, grants por columna de internal_notes, tablas financieras y esquema expuesto
`schemas = ["public"]` permanecen intactos.

`src/lib/users/server/provisioning.mjs` contiene `createBusinessMember`, con
`server-only`, validación y callback `authorize` obligatorio antes de consultar o
crear identidades. El callback debe proceder de código confiable del servidor;
no es un booleano ni identidad aportados por el navegador. La integración futura
deberá usar resolveCurrentOperator, validar pertenencia activa, negocio activo y
rol owner. No hay Route Handler ni Server Action expuesta en esta fase.

Se genera UUID v4 y `member-<uuid>@example.com`; Auth Admin recibe ese mismo id,
email, contraseña y `email_confirm: true`. No hay signup público, confirmaciones
por correo ni recuperación por ese email reservado. El identificador visible
es username; el email no se duplica en public y se podrá recuperar con Auth Admin
por user_id. No se añade metadata con secretos ni login username/password.

La contraseña explícita (mínimo local de 12 caracteres, sujeto además a las reglas
de Auth) solo se envía a Auth. Si el bootstrap inicial no recibe una contraseña,
genera una credencial aleatoria de infraestructura que no se muestra ni se usa
en el acceso cotidiano. El PIN se envía transitoriamente a la RPC para su hash privado.
No se registran inputs ni errores crudos del SDK/SQL, que pueden contener valores
sensibles. El resultado solo contiene businessId, userId, memberId y username.
Los módulos .mjs usan JSDoc con `@ts-check` y se incluyen en TypeScript, para que
la CLI Node y el futuro backend compartan implementación sin nuevas dependencias.
No se fabrica database.types.ts. `temporaryPassword` y `pin` plaintext de
UsersContext/UserAccount pertenecen solo al prototipo: no se importan ni migran.

Auth Admin y PostgreSQL no comparten una transacción. Si falla la RPC tras crear
Auth, se consulta primero la membresía por user_id para recuperar una respuesta
perdida; si no se confirma, se intenta borrar solo el Auth user recién creado.
La FK impide borrarlo si ya tiene membresía. Si falla la compensación, se informa
solo el user_id para intervención. Si la creación Auth o negocio devuelve un
resultado incierto, se informa su UUID: revisar el estado antes de repetir, porque
una caída de red puede dejar un recurso creado. No hay reintentos ciegos ni borrado
de identidades preexistentes. Las compensaciones no equivalen a atomicidad entre servicios.

## Bootstrap del primer Owner (ejecución manual posterior)

0002 ya fue aplicada, según el estado cloud comunicado. El bootstrap se conserva
como herramienta manual; no se ejecuta como parte de Fase 2B.1. Codex no lo ejecutó
con credenciales ni creó usuarios cloud.
Configurar en el entorno de una terminal confiable, sin secretos en Git, argumentos
de línea de comandos, logs o historial de comandos:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
BOOTSTRAP_BUSINESS_NAME=
BOOTSTRAP_BUSINESS_SLUG=
BOOTSTRAP_OWNER_FIRST_NAME=
BOOTSTRAP_OWNER_LAST_NAME=
BOOTSTRAP_OWNER_USERNAME=
# Opcional: si se omite, el bootstrap genera una credencial Auth aleatoria
# que no se muestra ni se usa en el acceso cotidiano por PIN.
# BOOTSTRAP_OWNER_PASSWORD=
BOOTSTRAP_OWNER_PIN=
```

Ejecutar desde apps/cash-control con Node >=22:

```sh
npm run bootstrap:first-owner
```

El comando usa `node --conditions=react-server scripts/bootstrap-first-owner.mjs`:
esa condición permite cargar `server-only` en esta CLI confiable. No usarla para
el dev server o las pruebas React del prototipo. No carga .env automáticamente;
recibe variables ya inyectadas en el proceso. No hace falta la publishable key.

El script valida todas las entradas antes de acceder a la red, recorta username,
busca el negocio por slug exacto y lo crea si no existe. Si el username ya existe
(ignorando mayúsculas), aborta antes de crear otro Auth user y no cambia contraseña.
El rol es siempre owner y display_name se forma con first_name + last_name.
La autorización aquí proviene del operador que posee la Secret Key, no de la UI.
No es una API para llamadas de usuarios normales.

Si falla, compensa Auth y elimina únicamente el negocio recién creado si sigue
vacío; la FK protege contra una membresía concurrente. Los índices únicos arbitran
bootstrap concurrentes: la carrera puede crear un Auth user transitorio perdedor,
que se compensa. Un fallo de compensación requiere resolver el UUID reportado antes
de reintentar. Un negocio existente nunca se elimina. stdout solo muestra IDs y
username; los errores controlados no imprimen contraseña, PIN, email interno o notas.

### Enlace del Owner Auth ya existente

Cuando la identidad Auth ya existe (por ejemplo, `zeferino@cashcontrol.com`), no
se debe ejecutar el bootstrap anterior porque ese flujo crea una identidad Auth
nueva. El comando `npm run provision:existing-owner` busca el correo exacto con
Auth Admin y reutiliza su UUID al llamar a `admin_provision_member`. Solo enlaza
el negocio existente por slug; no crea tablas, usuarios Auth ni RPC nuevas. Si el
username ya está enlazado a la misma identidad, restablece el PIN mediante
`admin_set_member_pin`; si pertenece a otra identidad o tiene un rol/estado
distinto, aborta sin modificarlo. Requiere `NEXT_PUBLIC_SUPABASE_URL` y
`SUPABASE_SECRET_KEY` (o el alias legado) inyectados únicamente en la terminal.
El script carga también los archivos `.env*` estándar del proyecto con el mismo
loader de Next.js; no es necesario exportar `OWNER_BUSINESS_SLUG`, cuyo valor
predeterminado es `cash-control`. Para este proyecto, la URL pública confirmada
de Supabase también tiene un fallback seguro; la Secret Key sigue siendo
obligatoria y nunca se muestra en la salida.

## Sesiones de estación y operador: Fase 2B.1

**PIN-only visual switch ≠ Supabase Auth identity switch.** Seleccionar Pedro
en Workstation mientras Auth sigue autenticado como María no cambia auth.uid().
Por eso selectedUserId no puede considerarse actor confiable. La arquitectura es:
**Supabase Auth identity → workstation activation → operator session**.
Auth comprueba la contraseña; una activación recuerda ese hecho durante la vida
de una estación. La operator session validada SERVER-SIDE identifica al operador
actual. No representa participación en turno. Workstation, MockSessionContext,
SessionGuard, UsersContext, turnos y datos financieros siguen siendo mock.

`0003_workstation_sessions.sql` crea exclusivamente:

- `private.workstation_sessions`: negocio, miembro creador, SHA-256 del token,
  creación, expiración, last_seen_at y revoked_at.
- `private.workstation_member_activations`: PK estación/miembro y authenticated_at.
- `private.operator_sessions`: estación, miembro, SHA-256, creación, expiración y
  revoked_at. Su FK compuesta exige una activación de ese miembro en esa estación.

El inicio de la primera estación también puede usar el flujo cotidiano de usuario
y PIN: el backend resuelve el miembro activo por negocio/username, verifica el PIN
con `admin_verify_member_pin`, crea la estación con las RPC existentes y establece
las mismas cookies HttpOnly. No crea una sesión Auth en el navegador ni acepta un
actor enviado por el cliente. El flujo de contraseña permanece disponible para
activación explícita de miembros existentes.

RLS habilitada sin policies públicas; se revocan permisos directos incluso de
service_role. `private` sigue fuera del Data API (`schemas = ["public"]`).
Las nueve RPC de 0003 son SECURITY DEFINER, `search_path = ''`, EXECUTE exclusivo
para service_role (revocado a PUBLIC, anon y authenticated):

- `admin_create_workstation_session`: verifica negocio/miembro activos y pertenencia,
  crea estación y activa automáticamente al creador, después de la prueba de contraseña.
- `admin_activate_workstation_member`: activa otro miembro del mismo negocio
  idempotentemente tras prueba de contraseña en backend.
- `admin_issue_operator_session`: exige estación válida y activación/membresía
  activas. Revoca el operador anterior e inserta el nuevo en la misma transacción.
- `admin_resolve_workstation_session`: solo devuelve estación/negocio/slug/expiración;
  actualiza last_seen_at sin extender TTL ni implementar inactividad.
- `admin_resolve_workstation_member`: comprueba activación y pertenencia antes del PIN,
  devolviendo únicamente la identidad segura; no consulta private desde PostgREST.
- `admin_resolve_operator_session`: resuelve actor y expiraciones únicamente si
  operador, estación, negocio y miembro siguen válidos. No devuelve secretos/notas.
- `admin_verify_member_pin`: wrapper de private.verify_member_pin que devuelve boolean.
- `admin_revoke_operator_session`: solo revoca ese operador mediante revoked_at.
- `admin_revoke_workstation_session`: revoca estación y todos sus operadores.

Emisión, activación y cierre se serializan con un lock de la fila workstation.
Un índice único parcial permite un solo operador no revocado por estación.
Un cambio de operador invalida el token anterior, incluso si otra pestaña lo conserva.
No se borran físicamente las sesiones ni se modifican turnos/participaciones.

Los módulos `src/lib/workstation/server/*.mjs` usan server-only y @ts-check:

- `authenticateMemberPassword`: resuelve businessSlug/username con las tablas reales
  y admin_find_member_by_username, exige membresía activa, obtiene el email interno
  mediante Auth Admin y verifica contraseña en un cliente NUEVO con publishable key.
  Comprueba que user.id devuelto coincide con el user_id de la membresía. Ese cliente
  no persiste sesión, no refresca tokens, no usa cookies/localStorage y no detecta
  sesiones en URLs. Ejecuta signOut(scope: local) para descartar la sesión transitoria
  sin cerrar otras sesiones del usuario. No copia ni devuelve access/refresh tokens.
- `startWorkstationWithPassword`: autentica, genera tokens separados de estación y
  operador, envía solo sus hashes y entrega identidad, tokens originales y expiraciones
  exclusivamente al caller de servidor para las futuras cookies.
- `activateMemberWithPassword`: resuelve primero la estación; el slug/negocio procede
  de ella, nunca de un businessId del navegador. Autentica, activa y emite operador.
- `unlockOperatorWithPin`: resuelve estación y miembro activado antes del PIN. La
  verificación es una RPC separada: `false` confirma intentos/bloqueo y no emite token.
  El memberId seleccionado se convierte en actor solo tras verificar todos los pasos.
- `resolveCurrentOperator`: requiere tokens de estación y operador coincidentes;
  devuelve identidad/IDs de sesión/expiraciones o null si no son válidos. Las fallas
  de infraestructura se distinguen mediante errores controlados, sin detalles SDK.
- `lockCurrentOperator` y `closeWorkstation`: revocaciones idempotentes por hash.

Los tokens son `randomBytes(32).toString('base64url')`, canónicos, independientes
y generados en servidor. Solo `SHA-256(token)` hexadecimal se envía a las RPC/DB.
No se añade APP_SESSION_SECRET. No hay almacenamiento multiusuario de tokens Auth,
cookies conectadas, Server Actions públicas ni cambios en la UI.

TTL absoluto centralizado en tokens.mjs: estación **24 h máximo**, operador **12 h
máximo**, limitado además por la expiración de la estación. SQL valida futuro y
límites máximos, incluidas constraints de tabla. Se requieren relojes del backend
y DB sincronizados. **No hay inactivity timeout**, renovación deslizante ni auto-lock
en el piloto. Estos TTL pertenecen solo a la nueva foundation.

### Fase 2B.2-A: sesión real aislada en Workstation

La integración inicial usa Route Handlers server-only bajo `/api/workstation` y
las cookies opacas `cc_workstation` y `cc_operator`: HttpOnly=true,
Secure=true en producción, Secure=false en desarrollo, SameSite=Lax y Path=/,
sin Domain manual. Los tokens nunca se serializan en respuestas, Client Components,
logs, localStorage, sessionStorage o URLs. `resolveCurrentOperator` recibe ambos
tokens únicamente desde las cookies del servidor y solo expone una identidad segura.

Las mutaciones validan `Origin` explícitamente. En producción se compara con
`APP_ORIGIN`; en desarrollo, sin esa variable, solo se aceptan localhost/127.0.0.1
en los puertos locales de Next.js. Origin ausente o externo se rechaza. La UI real
comenzó en `/workstation` mediante `RealWorkstationSessionProvider`; el
`MockSessionContext`, la participación del piloto y todo el piloto financiero siguen
intactos e in-memory. El puente de Fase 2B.2-B reutiliza ese contexto para la sesión
de aplicación y los guards, sin convertirlo en actor financiero. Lock conserva la
estación y elimina solo el operador; Close revoca la estación y elimina ambas cookies.

Si se pierde la respuesta de emisión, se intenta revocar el token no entregado;
si falla un inicio, también se revoca la estación nueva. No hay reintentos ciegos
de emisión. Un error de revocación no se reporta como éxito; se informa un código
controlado sin token/hash/password/PIN/email. La activación puede conservarse cuando
su contraseña fue válida pero falló la emisión posterior. Las RPC con service_role
son primitivas confiables: nunca concederlas al navegador ni invocarlas desde un
endpoint sin estas comprobaciones.

En cada entorno desplegado, `APP_ORIGIN` debe configurarse con el origen exacto
que usa el navegador, por ejemplo `https://cash-control.vercel.app`, sin ruta,
query ni hash. Es obligatorio en producción para que las mutaciones de inicio,
activación, desbloqueo y cierre puedan establecer o modificar las cookies de
sesión.

### Fase 2B.2-A.1: enumeración segura de miembros activados

`0005_list_workstation_members.sql` agrega únicamente el RPC de lectura
`admin_list_workstation_members(text)`, ejecutable solo por `service_role`. Recibe
el SHA-256 del token de workstation, valida la estación activa mediante sus joins,
y devuelve solo `member_id`, `username`, `display_name` y `role` de miembros activos
activados en esa estación. El endpoint server-only `GET /api/workstation/members`
lee `cc_workstation` desde la cookie HttpOnly; no acepta negocio, estación ni token
desde query/body. La lista se carga al montar/refrescar la sesión y después de
activar; permanece tras lock y se limpia tras close. La migración sigue local y no
ha sido aplicada al cloud.

Las futuras mutaciones financieras obtendrán **actor_user_id de
resolveCurrentOperator().userId**, nunca de un payload o selectedUserId. Deben
autorizar rol/negocio y revalidar vigencia dentro de su transacción para evitar
una carrera entre resolución y revocación. La RLS anterior basada en auth.uid()
permanece como protección de las lecturas authenticated; no representa el operador
de estas escrituras backend con service_role.

### Fase 2B.2-B: puente de sesión real hacia la aplicación

`RealAppSessionProvider` convierte la sesión de Workstation en la fuente real de
identidad para la aplicación. Reutiliza el único contexto de
`RealWorkstationSessionProvider`, resuelve siempre mediante
`GET /api/workstation/resolve` y expone a los guards únicamente el estado, la
identidad segura, `refresh`, `lock` y `close`. Los tokens, hashes, PIN y
credenciales no llegan al cliente.

El provider se monta en el layout raíz. `SessionGuard` autoriza las rutas internas
solo cuando el estado real es `ACTIVE`; `NO_WORKSTATION`, `NO_OPERATOR` e
`INVALID_SESSION` redirigen a `/workstation` sin ciclos. `OwnerOnlyGuard` conserva
su frontera propia y usa el rol de la identidad real. `ParticipationGuard` y
`MockSessionContext` siguen siendo parte del piloto in-memory: no se sincronizan
con la identidad real ni determinan si la sesión real está autenticada.

La cabecera muestra el display name y username del operador real cuando existe.
Lock elimina únicamente el operador y deja accesible la workstation; Close elimina
ambas cookies y deja el estado en `NO_WORKSTATION`. Esta fase no conecta el actor
real con depósitos, retiros, caja, bancos, turnos ni ninguna otra mutación
financiera.

### Fase 2C.1: persistencia de turnos y participantes

`0006_shifts_and_participants.sql` agrega únicamente el modelo operativo de turnos
y participantes. Las tablas viven en `private`, tienen RLS habilitada y no tienen
permisos directos, incluso para `service_role`; las operaciones se exponen mediante
RPC SECURITY DEFINER con `search_path = ''` y ejecución exclusiva de `service_role`.

El folio `TUR-000001` es generado por una secuencia PostgreSQL y el índice único
parcial permite como máximo un turno abierto por negocio. Las claves foráneas
simples mantienen las filas referenciadas existentes; triggers de restricción
deferibles validan dentro de PostgreSQL que el `business_id` del turno, el del
participante y el de su miembro sean iguales. Esto evita modificar
`business_members` con la clave redundante `(id, business_id)` y no delega la
integridad en JavaScript.
La base garantiza un único participante activo por miembro, conserva el historial
cuando abandona y mantiene exactamente un responsable activo en un turno abierto.
La transferencia cambia la proyección del turno y los roles de participantes dentro
de una única RPC; todavía no existe RPC de cierre ni se persisten importes,
depósitos, retiros o saldos.

Las RPC reciben únicamente el hash del token de operador y derivan el actor mediante
la sesión real de estación/operador. `src/lib/shifts/server/shifts.mjs` valida esa
sesión con `resolveCurrentOperator`, envía las mutaciones a las RPC y devuelve
proyecciones estrictas sin secretos. No se conecta `ShiftContext`, no se crea ruta
`/shifts` y no cambia la UI ni la lógica financiera.

Las mutaciones usan un orden de locks explícito: resolución del operador con lock
compartido de la workstation; apertura con lock de la fila de negocio; y agregar,
salir o transferir con lock de la fila del turno antes de tocar participantes o
miembros. La secuencia de folios es monotónica y no reutiliza valores; puede dejar
huecos si una transacción obtiene un `nextval` y después hace rollback.

### Fase 2C.2: conexión de `/shifts` con persistencia

`/shifts` consulta y muta turnos y participantes mediante Route Handlers
server-only. La sesión real de workstation/operador determina al actor; el
navegador solo puede enviar el miembro destino de una operación permitida y no
puede autorizarla con `userId`, `actorId` ni otro identificador de actor.

La transferencia de responsabilidad conserva el PIN obligatorio del nuevo
responsable en la UI. La migración local
`0007_atomic_shift_transfer_pin.sql` agrega una RPC atómica que resuelve al
actor desde las cookies de sesión, comprueba que el destino sea un participante
activo del mismo negocio, valida el PIN mediante `private.verify_member_pin` y
solo actualiza la responsabilidad después de una validación correcta. Un PIN
incorrecto devuelve un error de negocio sin filtrar el PIN y conserva el
contador de intentos fallidos, porque la RPC devuelve `false` en vez de lanzar
una excepción durante esa validación.

`0007_atomic_shift_transfer_pin.sql` está preparada localmente y no ha sido
aplicada a Supabase cloud. Por tanto, la transferencia requiere aplicar esa
migración antes de desplegar esta versión contra el proyecto remoto; no se
debe considerar disponible en cloud hasta que el nuevo RPC exista allí.

## Reglas para las fases financieras

- Dinero como `bigint` en **CENTAVOS**, sin float para fórmulas críticas en DB.
- Mutaciones financieras futuras mediante transacciones PostgreSQL.
- Todas las entidades operativas tendrán `business_id` y aislamiento por negocio.
- El actor operativo será userId de resolveCurrentOperator; no confiar en IDs/roles
  del cliente ni asumir que un cambio visual cambia auth.uid().
- Mantener las fórmulas existentes; validar equivalencia antes de migrar módulos.

## Validación local y tipos

Se incluye configuración CLI local sin secretos y seed solo con comentarios.
Con Supabase CLI y Docker disponibles, desde apps/cash-control:

```sh
supabase start
supabase db reset --local
supabase db lint --local --level warning
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/identity_and_business.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/auth_provisioning.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/workstation_sessions.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/shifts.sql
supabase gen types typescript --local --schema public > src/types/database/database.types.ts
```

`db reset --local` borra solo la base de desarrollo local: usar una instancia
local desechable. No ejecutar reset remoto. El test SQL usa una transacción y
rollback, crea Auth users reales de prueba y no deja registros.
Incluye verificaciones de permisos por columna (notas denegadas a authenticated,
columnas permitidas legibles y acceso administrativo de service_role), lectura
directa de notas rechazada y nombres de perfil vacíos, con espacios o NULL rechazados.
Los tipos se generarán después de aplicar SQL (ver `src/types/database/README.md`);
no se fabricó un database.ts ni tipos públicos para secretos.

El test auth_provisioning usa transaction + rollback y fixtures auth.users creados
solo por postgres en una base de test. Cubre permisos, aprovisionamiento, PIN,
duplicados, rollback de inserciones parciales y rotación con reinicio de bloqueo.
No autoriza insertar auth.users manualmente desde la aplicación.
Sin Supabase local disponible, las suites SQL se revisan estáticamente; no se
presentan como pruebas ejecutadas en PostgreSQL. Las pruebas Node con clientes
simulados se ejecutan por separado:

```sh
node --conditions=react-server --test tests/auth-provisioning.mjs
node --conditions=react-server --test tests/workstation-sessions.mjs
node --conditions=react-server --test tests/shifts-server.mjs
```

Validación histórica de Fase 2A (2026-09-09): Node v22.20.0, `npx tsc --noEmit`, Biome
sobre los siete archivos JS/config soportados modificados y `npm run build`
correctos. Pasaron 72 pruebas existentes (3 infraestructura, 46 turnos, 12
correcciones, 11 corte) y 10 pruebas nuevas del backend con cliente simulado.
En el sandbox se usó `--experimental-test-isolation=none`, ejecutando cada suite
existente en un proceso separado por sus mocks de módulos. Biome no analiza SQL,
Markdown ni dotenv. El bootstrap se comprobó únicamente con entrada obligatoria
vacía: abortó antes de la red. No se ejecutó con credenciales completas.

**Codex no ejecutó 0002 ni las suites SQL contra PostgreSQL/Supabase real.**
No se detectaron CLI/psql ni una instancia escuchando en el puerto local 54322.
La revisión SQL fue estática. Tampoco se creó un Auth user remoto ni se aplicó
migración cloud. El build conserva las rutas del piloto y su proxy.

Validación de Fase 2B.1 (2026-09-09): `npx tsc --noEmit`, Biome sobre archivos
soportados modificados y `npm run build` correctos con Node v22.20.0. Pasaron
**82 pruebas Node existentes y 17 nuevas (99 en total)**. Los clientes nuevos se
probaron con simulaciones, sin llamadas a Supabase cloud. Se cubren contraseña,
identidad Auth coincidente, activación, PIN, hashes, TTL, revocación, separación de
clientes y ausencia de secretos en resultados/errores. La suite SQL de workstation
usa transaction + rollback para permisos, activaciones, actor, expiraciones,
revocaciones y lockout de PIN. **0003 y las pruebas SQL solo tuvieron revisión
estática en esa validación: no se ejecutaron en PostgreSQL/Supabase.** No había
CLI/psql ni instancia local disponible en el puerto configurado. No se ejecutó
bootstrap ni se crearon usuarios o datos cloud durante esa validación.
0001/0002/0003 y el prototipo operativo
permanecen intactos.

## Revisión antes de Fase 2B.2

- Mantener 0001/0002/0003 inmutables; aplicar 0004 solo tras revisar los índices en
  una base de prueba y ejecutar la suite SQL correspondiente.
- Integrar cookies y UX de acceso/bloqueo con estos servicios sin confiar en actor del cliente.
- Revisar Exposed schemas remoto, propietario de funciones y matriz RLS con SQL real.
- Implementar el acceso Owner-only a internal_notes desde servidor con sesión,
  pertenencia al negocio y rol verificados antes de usar el cliente administrativo.
- Membresías usan FK sin cascada: eliminar un Auth user con membresía se bloquea;
  privilegiar suspensión y definir después retención/borrado de identidad.
- No hay trigger automático de perfiles ni API de PIN accesible desde navegador.
- npm/package-lock.json es el flujo validado para esta entrega. pnpm-lock.yaml
  preexistente no se actualiza con npm; sincronizarlo si se elige pnpm en CI.
- Ejecutar migración y tests en Supabase local antes de aplicarlos a un proyecto.

Referencias: [Supabase SSR para Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[signOut](https://supabase.com/docs/reference/javascript/auth-signout),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html).
