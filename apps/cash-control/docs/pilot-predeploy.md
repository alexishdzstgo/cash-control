# Piloto: acceso y sesión

La ruta principal es `/` (no `/dashboard`). Todas las rutas del grupo
`src/app/(app)` usan SessionGuard antes de montar AppShell. Sin
`authenticatedUser` no se muestra contenido interno y se redirige con
`router.replace("/workstation")`. `/workstation` permanece fuera del grupo.

SessionGuard comprueba la sesión mock en el cliente. OwnerOnlyGuard conserva
los permisos por rol y ParticipationGuard conserva las reglas de participación;
este último también redirige a `/workstation` cuando no hay sesión.

«Bloquear sesión» ejecuta el bloqueo manual existente: elimina el usuario
desbloqueado, pero conserva participaciones, responsable y turno. Es una acción
distinta de finalizar participación. Volver a acceder con PIN no crea una nueva
participación.

No hay bloqueo automático por inactividad en el código ejecutable. Los timers
existentes controlan notificaciones y desplazamiento de pantalla, no la sesión.
El bloqueo automático adaptativo queda pendiente; no se configura ningún plazo
durante el piloto. La sesión puede permanecer abierta sin actividad.

Los datos siguen siendo locales/en memoria y se pierden al recargar. Esta
protección temporal no implementa Auth real ni autorización de servidor. La
Fase 1 de Supabase y su proxy permanecen intactos.

La metadata raíz declara `noindex, nofollow`. Se requiere Node >=22.0.0,
compatible con las versiones instaladas de Supabase y Next.js.

## Verificación del parche (2026-09-09)

- Node utilizado: v22.20.0.
- TypeScript: `tsc --noEmit` correcto.
- Build: `npm run build` correcto, con las 18 rutas solicitadas y el proxy.
  El primer intento no pudo descargar Geist/Geist Mono; pasó al permitir red.
- Biome en los seis archivos de código/configuración modificados o creados:
  correcto. El lint global sigue fallando por 69 errores y 16 advertencias
  fuera del parche; no se reformatearon módulos ajenos al alcance.
- Suite existente: 46/46 pruebas correctas con
  `node --test --experimental-test-isolation=none tests/shifts.cjs`.
  Sin esa opción, el sandbox impide crear el proceso de pruebas (`spawn EPERM`).
- Comprobación aislada de los tres guards: sin sesión devuelven `null` y
  redirigen; SessionGuard permite owner/employee; OwnerOnlyGuard rechaza
  employee y permite owner. ParticipationGuard redirige sin sesión.
- Navegador, build de producción local: `/`, `/deposits`, `/cash-closing`,
  `/business-funds` y `/users` sin sesión terminan en `/workstation`.
- PIN válido abre `/`; el bloqueo manual conserva los dos participantes,
  responsable y horarios. Reingresar y bloquear otra vez mantiene esos datos
  sin duplicar participación.
- Rutas verificadas en build y navegación del owner: `/`, `/workstation`,
  `/deposits`, `/withdrawals`, `/pending-withdrawals`, `/history`,
  `/business-funds`, `/balances`, `/bank-alerts`, `/shifts`, `/cash-closing`,
  `/audit`, `/staff`, `/users`, `/commissions`, `/receipts`, `/settings`,
  `/profile`. Ningún href roto en navigationConfig; Ganancias y reportes
  sigue deshabilitado.
- La prueba de empleado en `/users` se cubrió mediante revisión de su wrapper
  y ejecución aislada de OwnerOnlyGuard, no mediante navegación de empleado.
  La ausencia de bloqueo por inactividad se verificó en código, sin una espera
  prolongada en navegador.
- No se publicó la aplicación.
