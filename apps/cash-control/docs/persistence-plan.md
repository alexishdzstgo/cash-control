# Plan de persistencia de Cash Control

## Fases

1. **Infraestructura + identidad:** clientes Supabase, proxy, negocios, perfiles,
   membresías, permisos de lectura y PIN privados. Completada y aplicada al cloud.
2. **Fase 2A — identidades Auth y aprovisionamiento backend:** creación de Auth users,
   perfiles/membresías/PIN y bootstrap del primer Owner. Preparada, pendiente de aplicar 0002.
   **Fase 2B — integración Auth con UX/sesión:** login, autorización del actor real
   y diseño explícito del cambio de operador/estación.
3. **Turnos + participantes:** persistir el ciclo operativo y participantes.
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
renombra ni reaplica desde Codex. Los cambios nuevos van en `0002_auth_provisioning.sql`.
En este parche no se ejecutaron mutaciones Admin ni migraciones remotas.

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
En Fase 2, una Server Action / Route Handler autorizado validará la sesión Supabase,
verificará que `auth.uid()` pertenece al negocio con membresía y negocio activos,
comprobará `role = owner` y solo entonces usará el cliente administrativo SERVER-ONLY
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

Antes de Fase 2B diseñar un endpoint de verificación que valide auth.uid(), negocio,
actor y destinatario antes de llamar al helper privado. La verificación debe
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
deberá validar sesión Supabase, auth.uid(), pertenencia activa, negocio activo y
rol owner. No hay Route Handler ni Server Action expuesta en esta fase.

Se genera UUID v4 y `member-<uuid>@example.com`; Auth Admin recibe ese mismo id,
email, contraseña y `email_confirm: true`. No hay signup público, confirmaciones
por correo ni recuperación por ese email reservado. El identificador visible
es username; el email no se duplica en public y se podrá recuperar con Auth Admin
por user_id. No se añade metadata con secretos ni login username/password.

La contraseña (mínimo local de 12 caracteres, sujeto además a las reglas de Auth)
solo se envía a Auth. El PIN se envía transitoriamente a la RPC para su hash privado.
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

Aplicar y revisar 0002 separadamente antes de ejecutar el bootstrap. Codex solo
prepara archivos: no ejecutó este script con credenciales ni creó usuarios cloud.
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
BOOTSTRAP_OWNER_PASSWORD=
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

## Separación de sesión: Fase 2B/3

**PIN-only visual switch ≠ Supabase Auth identity switch.** Seleccionar Pedro
en Workstation mientras Auth sigue autenticado como María no cambia auth.uid().
Por eso selectedUserId no puede considerarse actor confiable. Workstation,
MockSessionContext, SessionGuard y los participantes/turnos siguen siendo mock.
La sesión real de operador/estación, logout, login y autorización desde la UI se
diseñarán explícitamente en Fase 2B/3 antes de integrar estas identidades.

## Reglas para las fases financieras

- Dinero como `bigint` en **CENTAVOS**, sin float para fórmulas críticas en DB.
- Mutaciones financieras futuras mediante transacciones PostgreSQL.
- Todas las entidades operativas tendrán `business_id` y aislamiento por negocio.
- `auth.uid()` será la identidad de seguridad; no confiar en IDs/roles del cliente.
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
Sin Supabase local disponible, ambas suites SQL se revisan estáticamente; no se
presentan como pruebas ejecutadas en PostgreSQL. Las pruebas Node con clientes
simulados se ejecutan por separado:

```sh
node --conditions=react-server --test tests/auth-provisioning.mjs
```

Validación de este parche (2026-09-09): Node v22.20.0, `npx tsc --noEmit`, Biome
sobre los siete archivos JS/config soportados modificados y `npm run build`
correctos. Pasaron 72 pruebas existentes (3 infraestructura, 46 turnos, 12
correcciones, 11 corte) y 10 pruebas nuevas del backend con cliente simulado.
En el sandbox se usó `--experimental-test-isolation=none`, ejecutando cada suite
existente en un proceso separado por sus mocks de módulos. Biome no analiza SQL,
Markdown ni dotenv. El bootstrap se comprobó únicamente con entrada obligatoria
vacía: abortó antes de la red. No se ejecutó con credenciales completas.

**No se ejecutaron 0002 ni las suites SQL contra PostgreSQL/Supabase real.**
No se detectaron CLI/psql ni una instancia escuchando en el puerto local 54322.
La revisión SQL fue estática. Tampoco se creó un Auth user remoto ni se aplicó
migración cloud. El build conserva las rutas del piloto y su proxy.

## Revisión antes de Fase 2B

- Revisar/aplicar 0002 separadamente y ejecutar el bootstrap con credenciales propias.
- Definir login por username/email, redirects y sesión real de operador.
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
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html).
