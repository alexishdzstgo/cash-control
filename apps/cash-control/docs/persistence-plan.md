# Plan de persistencia de Cash Control

## Fases

1. **Infraestructura + identidad:** clientes Supabase, proxy, negocios, perfiles,
   membresías, permisos de lectura y PIN privados. Sin conectar la UI (esta entrega).
2. **Supabase Auth + Usuarios:** autenticación real, primer Owner, provisión de
   perfiles/membresías y administración de cuentas desde el servidor.
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
se crea. No se conectó ningún proyecto remoto ni se ejecutan mutaciones Admin.

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
acceso directo de esa role a member_pins ni RPC público en esta fase.

Antes de Fase 2 diseñar un endpoint/RPC restringido que valide auth.uid(), negocio,
actor y destinatario antes de llamar al helper privado. La verificación debe
confirmar su transacción incluso ante PIN incorrecto: un rollback posterior
anularía el contador. No registrar PIN en logs. La creación/rotación del hash
requiere un flujo privado autorizado futuro; no exponer private para resolverlo.

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

## Revisión antes de Fase 2

- Elegir proyecto, Auth (incluido login por username/email), redirects y primer Owner.
- Revisar Exposed schemas remoto, propietario de funciones y matriz RLS con SQL real.
- Implementar el acceso Owner-only a internal_notes desde servidor con sesión,
  pertenencia al negocio y rol verificados antes de usar el cliente administrativo.
- Membresías usan FK sin cascada: eliminar un Auth user con membresía se bloquea;
  privilegiar suspensión y definir después retención/borrado de identidad.
- No hay trigger automático de perfiles ni API para provisionar PIN todavía.
- npm/package-lock.json es el flujo validado para esta entrega. pnpm-lock.yaml
  preexistente no se actualiza con npm; sincronizarlo si se elige pnpm en CI.
- Ejecutar migración y tests en Supabase local antes de aplicarlos a un proyecto.

Referencias: [Supabase SSR para Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html).
