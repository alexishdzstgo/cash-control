# Cash Control — Documento de Rediseño UX/UI

**Proyecto Cero · Xolobit**

**Fecha:** 8 de febrero de 2026  
**Rol:** Product Designer Senior  
**Entregable:** Documento de diseño (sin implementación)

---

## 0. Resumen ejecutivo

El sistema actual tiene una base sólida de componentes y una buena lógica de negocio, pero la interfaz no cumple aún con la filosofía del producto: **"Todo está bajo control."** Existen múltiples paletas de color desconectadas entre sí, jerarquías visuales inconsistentes, y pantallas que compiten por protagonismo entre tablas y tarjetas. El dashboard no responde directamente a la pregunta central *"¿Cómo está mi negocio?"*.

El rediseño propuesto aquí **no cambia lógica de negocio, ni base de datos, ni permisos**. Es exclusivamente un plan de UX/UI que prioriza la tranquilidad del dueño.

---

## 1. Problemas encontrados (inventario general)

| # | Categoría | Problema | Evidencia |
|---|-----------|----------|-----------|
| 1 | Bug UI | `DashboardGreeting` está definido pero **nunca se renderiza** en `DashboardPage` | `DashboardPage.tsx` solo renderiza `QuickActions`, `StatsGrid`, `ActivityFeed` |
| 2 | Consistencia | Existen **3 sistemas de tokens de color** para el mismo concepto de operación (depósito/pendiente) en `globals.css` | tokens con doble definición: `--deposit-soft` vs `--color-deposit-50`; `--withdrawal-*` vs `--color-withdrawal-*` vs `--deposit-*` |
| 3 | Consistencia | Los **Retiros** usan verde esmeralda en toda la app, pero el usuario los percibe como "dinero que sale" (el rojo sería lo natural o al menos no positivo) | `globals.css` define `--withdrawal-*: #10b981` |
| 4 | Consistencia | El **ámbar** (reservados) se usa correctamente en Saldos, pero también se usa para estados "Pendiente" en badges de historial | `OperationStatusBadge` usa `bg-amber-100` para "Pendiente" |
| 5 | Jerarquía | Los **botones principales** en formularios usan el color semántico de la operación (azul depósito / verde retiro) en vez de un color de acción consistente | `DepositSummary` y `WithdrawalSummary` |
| 6 | Jerarquía | El **sidebar** tiene un color de fondo distinto (slate-900 oscuro) que no conecta con la marca azul `--brand-primary` | `Sidebar.tsx` usa `bg-slate-900` |
| 7 | UX | El **Dashboard** muestra 4 tarjetas + 4 acciones rápidas + 5 actividades = **13 items compitiendo** por atención en la primera pantalla | `DashboardPage`, `StatsGrid`, `QuickActions`, `ActivityFeed` |
| 8 | UX | Los números alineados **no usan `tabular-nums`** en la mayoría de las tarjetas de balance | `MetricCard`, `BalanceSummary`, `CashBalanceCard` |
| 9 | UX | Las **tablas del historial** son el protagonista en lugar del resumen, violando el principio "resumen primero, detalle después" | `OperationsTable` |
| 10 | Consistencia | Los **inputs** tienen 3 variantes de color (deposit/withdrawal/neutral) que no tienen significado semántico para el usuario | `AmountField`, `DepositForm` |
| 11 | UX | El **corte de caja** no presenta un botón de "Iniciar cierre" en el sidebar a pesar de ser la acción más crítica del día | `Sidebar.tsx` |
| 12 | Navegación | La navegación mezcla **operaciones** (Retiros, Depósitos) con **consultas** (Saldos, Historial) y **gestión** (Turnos) sin agrupar | `Sidebar.tsx` |

---

## 2. Problemas de UX

### 2.1 El usuario necesita hacer cálculos mentales
- En `CashBalanceCard` el usuario debe restar "Saldo físico − Reservado" para entender lo que tiene disponible.
- En `ExpectedCashSummary` del corte, se muestran 6 cifras con indicaciones verbales ("No confundir efectivo esperado con disponible") — esto es una señal de que el diseño no comunica bien.
- En `BalanceSummary` el "Disponible para operar" no se explica cómo se calculó.

### 2.2 El sistema no explica antes de mostrar
- La barra de progreso de `CashBalanceCard` y `BankAccountCard` muestra dos porcentajes sin un contenedor visual claro de qué representa cada uno.
- El estado "low" en `BankAccountCard` usa un **dot de color ámbar** sin texto de ayuda si el usuario no lee el badge.

### 2.3 La interfaz no responde una sola pregunta por pantalla
- **Dashboard:** mezcla saldo, usuarios, acciones y actividad reciente — 4 preguntas a la vez.
- **Historial:** la tabla ocupa todo el viewport y el resumen ni siquiera existe.
- **Retiros pendientes:** presenta 2 tarjetas resumen + tabla, pero el flujo de "confirmar entrega" implica un diálogo de confirmación innecesario para una acción reversible.

### 2.4 Falta de estados de carga, vacíos informativos
- Los componentes usan datos mock. No hay **skeleton loaders** en ningún lugar.
- Los **estados vacíos** son genéricos ("No hay actividad reciente") sin guía de acción concreta.

### 2.5 El cierre de turno no es el mejor momento del sistema
- El flujo de inicio de conteo usa un botón en una caja gris dentro de la página, no un llamado claro.
- La experiencia "de conteo" requiere que el usuario escrole hasta el final para ver la diferencia en tiempo real — el dato más importante del corte.

---

## 3. Problemas de UI

### 3.1 Paleta de color
- **3 paletas separadas:** slate para la app, brand (azul) para la marca, y semanticos (verde/azul/violeta) para operaciones.
- **El morado** (viola) se asigna a "pendientes" (operaciones sin completar) y a la marca a la vez.
- **El rojo** aparece en errores, faltantes, y "Editado" — correcto, pero falta restricción: no debe usarse en más contextos.
- **El ámbar** se usa para "reservado" correctamente, pero también para el badge de "Pendiente" de operaciones.

### 3.2 Tipografía
- Usa **Geist Sans** — legible, pero **no tiene números tabulares** declarados globalmente.
- Los títulos de página son `text-2xl` pero las tarjetas del dashboard usan `text-4xl/5xl` — desproporción de jerarquía.
- Los labels de los inputs son `text-sm font-semibold text-slate-700` — suficiente contraste, pero el placeholder es `text-slate-400` lo cual es bajo en contraste (4.5:1+ recomendado para texto).

### 3.3 Componentes
- **Cards:** consisten en border-slate-200 + white + shadow-sm — correcto, pero se usan **en exceso** (incluso para bloques de contenido simples dentro de otras cards).
- **Badges:** demasiados estilos: `bg-slate-100`, `bg-emerald-100`, `bg-blue-100`, `bg-amber-100`, `bg-red-100`, `bg-deposit-100`, `bg-withdrawal-100`, `bg-pending-100`, `bg-violet-100`. **9 tonalidades distintas.**
- **Botones:** 3 estilos distintos para texto (fondo semántico, fondo slate-900, fondo emerald-600 en `ConfirmDialog`/`SuccessDialog`).
- **Inputs:** 4 estilos de focus (deposit, withdrawal, neutral, custom en `FolioField`).
- **Modales:** `ConfirmDialog` usa `bg-emerald-600` para confirmar, mientras que `SuccessDialog` usa `bg-emerald-700`. Inconsistente entre sí.
- **Sidebar:** fondo `bg-slate-900`, enlaces con color de fondo del módulo activo (azul para depósitos, verde para retiros, violeta para pendientes) — esto hace que cada item se vea "especial" y rompe la calma visual.

---

## 4. Problemas de jerarquía visual

1. **El dinero no tiene prioridad visual** en el dashboard. Las "Acciones rápidas" van primero, y las métricas de dinero están en segundo lugar. Debería ser al revés.
2. **Las tablas roban protagonismo** al resumen en Historial y Retiros pendientes. En ambas pantallas el resumen es texto pequeño o tarjetas secundarias.
3. **Los iconos compiten con el valor numérico.** Los iconos con `bg-*-100` + `text-*-700` + tamaño 10x10, y luego el título, luego el valor de 4xl. El ojo va al icono, no al número.
4. **El sidebar oscuro no jerarquiza el contenido del panel derecho.** El panel derecho usa fondo claro con tarjetas blancas. El contraste es abrupto.
5. **El badge de "Activo" en `ActiveShiftCard`** usa `bg-emerald-100` + `text-emerald-800`, lo cual se confunde con la semántica de retiros/verde (que es "dinero que sale").

---

## 5. Problemas de navegación

### 5.1 Estructura actual del sidebar
```
Dashboard
Retiros
Retiros pendientes
Depósitos
Saldos
Corte de caja
Turnos
Historial
Configuración [deshabilitado]
```

### 5.2 Problemas
- **Saldos es el corazón del sistema** pero está en el quinto lugar.
- **Retiros** y **Retiros pendientes** son el mismo dominio pero están separados.
- **Corte de caja** debería ser accesible desde el dashboard y no solo el sidebar.
- **Configuración** deshabilitado con un badge "Próximamente" genera ruido.

### 5.3 Propuesta reorganizada (se aplicará en Fase posterior)
```
┌──────────────────────────────────────┐
│  Dashboard                           │
├──────────────────────────────────────┤
│  DINERO                              │
│  ├─ Caja y bancos  (anterior Saldos)  │
│  └─ Historial                        │
├──────────────────────────────────────┤
│  OPERACIONES                         │
│  ├─ Retiros                          │
│  │   └─ [filtro: pendientes]         │
│  └─ Depósitos                        │
├──────────────────────────────────────┤
│  TURNO                               │
│  ├─ Turno activo                     │
│  └─ Cierre de turno                  │
└──────────────────────────────────────┘
```

---

## 6. Problemas de consistencia

| Área | Inconsistencia |
|------|----------------|
| Tokens de color | Doble definición de las mismas variables en `globals.css` |
| Semántica | "Pendiente" usa amber en `OperationStatusBadge` pero violet en operaciones "pending" |
| Botones de confirmación | `ConfirmDialog` usa emerald, `SuccessDialog` usa emerald-700, formularios usan deposit-solid/withdrawal-700 |
| Sidebar vs marca | Sidebar oscuro (slate-900) vs marca azul (brand-primary) |
| Radi de cards | Las cards del dashboard y de saldos usan `rounded-2xl`, pero las del corte usan `rounded-xl` |
| Input placeholders | Algunos con `slate-400`, otros con `slate-500` |
| Formato de fechas | `formatDateTime` en ActivityFeed, `toLocaleString` en ActiveShiftCard y ShiftHistory — resultados visuales distintos |
| Números | `formatCurrency` en balances pero `$xxx.toLocaleString()` en ActiveShiftCard |

---

## 7. Pantallas que deben rediseñarse

### Prioridad ALTA
1. **Dashboard** — debe responder "¿Cómo está mi negocio?" con una sola pregunta visual.
2. **Caja y bancos (Saldos)** — debe convertirse en el centro del sistema.
3. **Corte de caja** — debe ser la experiencia más tranquila y clara.

### Prioridad MEDIA
4. **Historial** — debe mostrar resumen antes que tabla.
5. **Retiros pendientes** — debe priorizar la entrega como acción principal.
6. **Retiros y Depósitos (flujos de registro)** — deben tener una navegación clara entre "completado / pendiente".

### Prioridad BAJA
7. **Turnos** — limpiar la sobrecarga de cards informativas.
8. **Workstation** — mantener, solo ajustar consistencia de estilo.

---

## 8. Prioridad de cada cambio

| # | Cambio | Prioridad | Impacto | Esfuerzo |
|---|--------|-----------|---------|----------|
| 1 | Unificar paleta de color en un solo token por concepto | Alta | Alto | Bajo |
| 2 | Corregir bug de `DashboardGreeting` no renderizado | Alta | Medio | Bajo |
| 3 | Rediseñar Dashboard con un solo hero de dinero + alertas | Alta | Muy alto | Medio |
| 4 | Convertir "Saldos" en "Caja y bancos" con hero de total | Alta | Muy alto | Medio |
| 5 | Mejorar flujo de corte: botón destacado, diferencia en tiempo real | Alta | Alto | Medio |
| 6 | Reorganizar sidebar por grupos | Media | Alto | Bajo |
| 7 | Añadir `tabular-nums` global a números de dinero | Media | Medio | Bajo |
| 8 | Simplificar badges a 4 estados: éxito / pendiente / alerta / error | Media | Medio | Bajo |
| 9 | Estandarizar inputs a un solo estilo | Media | Bajo | Bajo |
| 10 | Añadir skeleton loaders | Media | Medio | Medio |
| 11 | Mejorar estados vacíos con guía de acción | Media | Bajo | Bajo |
| 12 | Unificar botones de confirmación | Baja | Medio | Bajo |

---

## 9. Mockup textual (wireframes) de cada pantalla

### 9.1 Dashboard

```
┌────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  [Header: usuario ▾]                         │
│            │                                                │
│ Dashboard  │  Hola, Alex                                    │
│            │  ¿Cómo va tu negocio hoy?                      │
│ Caja y     │                                                │
│ bancos     │  ┌─────────────────────────────────────────┐   │
│            │  │  DINERO TOTAL CONTROLADO               │   │
│ Historial  │  │                                        │   │
│            │  │  $66,770.00                            │   │
│ Retiros    │  │  Caja: $12,450 · Bancos: $54,320       │   │
│            │  │  💡 Reservado: $3,200                  │   │
│ Depósitos  │  └─────────────────────────────────────────┘   │
│            │                                                │
│ Turno      │  ┌─────────────────────────────────────────┐   │
│            │  │  ⚠ Tienes 2 retiros pendientes          │   │
│ Cierre     │  │  $1,800 por entregar                    │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                │
│            │  [Nuevo retiro]  [Nuevo depósito]  [Ver caja]  │
│            │                                                │
│            │  Actividad reciente (últimos 3)                │
│            │  [Depósito · $500 · Folio 4581 · 2:15 PM]      │
│            │  [Retiro · $300 · Folio 8372 · 1:58 PM]        │
│            └────────────────────────────────────────────────┘
```

**Principio:** Un solo hero grande de dinero controlado. Alertas solo si hay problema. Acciones sin competir con los números.

---

### 9.2 Caja y bancos

```
┌────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  [Header: usuario ▾]                         │
│            │                                                │
│ Caja y     │  ¿Dónde está mi dinero?                        │
│ bancos     │  ──────────────────────────────────────────    │
│            │                                                │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │  TOTAL DISPONIBLE PARA OPERAR           │   │
│            │  │  $63,570.00                            │   │
│            │  │  Reservado: $3,200 · Sin comprometer   │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                │
│            │  ┌──────────────┐  ┌───────────────────────┐   │
│            │  │ CAJA FÍSICA  │  │ BANCO AZTECA          │   │
│            │  │ $12,450      │  │ $30,000 real          │   │
│            │  │ Disp: $10,650│  │ Disp: $28,000         │   │
│            │  │ Reservado    │  │ Reservado: $2,000     │   │
│            │  └──────────────┘  └───────────────────────┘   │
│            │                                                │
│            │  [Detalle desglosado de dónde está cada peso]   │
│            └────────────────────────────────────────────────┘
```

**Principio:** Responder "¿Dónde está mi dinero?" en un solo vistazo. La reserva se indica, no se resalta.

---

### 9.3 Corte de caja

```
┌────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  [Header: usuario ▾]                         │
│            │                                                │
│ Cierre     │  ¿Puedo cerrar con tranquilidad?                │
│            │  ──────────────────────────────────────────    │
│            │                                                │
│            │  [INICIAR CIERRE] ← botón principal destacado  │
│            │                                                │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │  EFECTIVO ESPERADO                       │   │
│            │  │  $10,500                                 │   │
│            │  │  Inicial + Entradas - Salidas            │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │  CONTEO FÍSICO                          │   │
│            │  │  $10,500  ✔ Caja cuadrada              │   │
│            │  │  (en rojo si hay diferencia)            │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                │
│            │  Desglose:                                     │
│            │  [Saldo inicial] [+$5,000 · 1 op]             │
│            │  [Depósitos recibidos] [+$8,200 · 4 ops]      │
│            │  [Retiros entregados] [-$2,700 · 2 ops]       │
│            └────────────────────────────────────────────────┘
```

**Principio:** Solo dos datos grandes: esperado y contado. La diferencia se muestra **al instante** mientras teclea. El desglose es colapsable.

---

### 9.4 Historial

```
┌────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  [Header: usuario ▾]                         │
│            │                                                │
│ Historial  │  ¿Qué operaciones tengo?                        │
│            │                                                │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │  RESUMEN  Depósitos 2 / Retiros 1       │   │
│            │  │  Total entradas: $8,200 · Total salidas:│   │
│            │  │  $2,700                                 │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                │
│            │  [Buscar · Filtros · fecha · estado]           │
│            │                                                │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │ Folio │ Tipo │ Monto │ Estado │ Fecha  │   │
│            │  │ 4581  │ Depot│ $500  │ ✔ Com.│ 2:15PM │   │
│            │  │ 8372  │ Retir│ $300  │ ⏳ Pend│ 1:58PM │   │
│            │  │ ...   │      │       │       │        │   │
│            │  └─────────────────────────────────────────┘   │
│            └────────────────────────────────────────────────┘
```

**Principio:** Resumen arriba, tabla abajo.

---

### 9.5 Retiros pendientes

```
┌────────────────────────────────────────────────────────────┐
│ [Sidebar]  │  [Header: usuario ▾]                         │
│            │                                                │
│ Retiros    │  ¿Qué retiros debo entregar?                    │
│ pendientes │                                                │
│            │  ┌─────────────────────────────────────────┐   │
│            │  │  2 RETIROS POR ENTREGAR                 │   │
│            │  │  $1,800 total                           │   │
│            │  └─────────────────────────────────────────┘   │
│            │                                                │
│            │  [Folio 8372]  $300   [Confirmar entrega]      │
│            │  [Folio 9851]  $1,500 [Confirmar entrega]      │
│            │                                                │
│            │  Las tarjetas son la unidad primaria.           │
│            └────────────────────────────────────────────────┘
```

**Principio:** Cada retiro pendiente es un objeto visual con acción directa. No una fila de tabla.

---

## 10. Plan de implementación por fases

> ⚠️ Ninguna fase modifica lógica de negocio, base de datos ni permisos.

### FASE 0 — Fundación visual (preparación segura)
**Duración:** 1-2 días  
**Objetivo:** Eliminar deudas técnicas visuales sin tocar comportamiento.

1. Unificar tokens de color en `globals.css`:
   - Definir **un solo** conjunto de variables por concepto (`--deposit-*`, `--withdrawal-*`, `--pending-*`).
   - Eliminar duplicados (`--deposit-soft` vs `--color-deposit-50`).
2. Definir sistema tipográfico: `tabular-nums` para todos los valores monetarios.
3. Crear `components/ui/badge.tsx` estandarizado con 4 variantes (success, info, alert, error).
4. Estandarizar `ConfirmDialog` y `SuccessDialog` con los mismos colores de acción.

**Riesgo:** Mínimo (solo clases y tokens de color).

---

### FASE 1 — Dashboard (corregir bug y replantear)
**Duración:** 2-3 días  
**Objetivo:** Que el dashboard responda "¿Cómo está mi negocio?"

1. Renderizar correctamente `DashboardGreeting` en la parte superior.
2. Rediseñar el hero: una sola tarjeta grande con **dinero total controlado**.
3. Mover "Acciones rápidas" a la parte inferior, como enlaces o botones.
4. Destacar alertas de salud (retiros pendientes, saldo bajo) en un contenedor de alerta.
5. Reducir `ActivityFeed` a los últimos 3 movimientos.

**Riesgo:** Bajo (solo composición de componentes existentes).

---

### FASE 2 — Caja y bancos (el corazón del sistema)
**Duración:** 2-3 días  
**Objetivo:** Convertir Saldos en el centro de consulta.

1. Renombrar en sidebar: "Saldos" → "Caja y bancos".
2. Introducir el hero de **total disponible para operar** con desglose.
3. Rediseñar las cards de cuenta sin barras de porcentaje (reemplazar por etiqueta de estado clara).
4. Simplificar `CashBalanceCard` y `BankAccountCard` mostrando solo 3 cifras: saldo real, reservado, disponible.

**Riesgo:** Bajo (solo composición).

---

### FASE 3 — Corte de caja
**Duración:** 2-3 días  
**Objetivo:** Que el cierre sea el momento más tranquilo del día.

1. Botón principal "Iniciar cierre" prominente.
2. Mostrar en tiempo real la diferencia al capturar el conteo (sin esperar a hacer clic).
3. Simplificar `ExpectedCashSummary` a solo "esperado" + breakdown colapsable.
4. Eliminar la nota descriptiva larga; sustituir por un break agradable.

**Riesgo:** Bajo.

---

### FASE 4 — Historial y retiros pendientes
**Duración:** 2 días  
**Objetivo:** Priorizar resumen sobre detalle.

1. Añadir resumen superior en `OperationsHistoryPage` (totales de entradas/salidas).
2. Convertir `PendingWithdrawalsPage` de tabla a **lista de tarjetas** con botón directo de "Confirmar entrega".
3. Estandarizar el estado vacío con icono + guía de siguiente acción.

**Riesgo:** Bajo.

---

### FASE 5 — Navegación y consistencia final
**Duración:** 2 días  
**Objetivo:** Reorganizar el sidebar y pulir la consistencia.

1. Reorganizar sidebar en grupos: Dashboard, Dinero, Operaciones, Turno.
2. Usar un único color de fondo activo en el sidebar (brand-primary).
3. Estandarizar inputs a un solo estilo neutral.
4. Unificar radios de cards a un solo valor (`rounded-xl` o `rounded-2xl`).
5. Revisar formatos de fecha y hora consistentes.

**Riesgo:** Bajo.

---

### FASE 6 — Refinamiento (opcional post-lanzamiento)
- Skeleton loaders.
- Dark mode pulido.
- Micro-interacciones de estado.

---

## 11. Indicadores de éxito

Después de cada fase, verificar:

- ✅ El usuario **no necesita hacer cálculos mentales** para entender en qué quedó.
- ✅ Cada pantalla responde **una sola pregunta**.
- ✅ El rojo solo aparece cuando hay pérdida o problemas.
- ✅ El verde representa **éxito** y tranquilidad, no tipo de operación.
- ✅ El sidebar es tranquilo, no colorido.
- ✅ El dueño puede cerrar su turno con la información a la vista, sin escrolear.

---

## 12. Conclusión

El sistema tiene 80% de componentes bien construidos. El 20% restante es la **dirección visual y la jerarquía**. Con estas fases no se toca la lógica de negocio, se recompone la presentación para que el dueño sienta:

> **"Todo está bajo control."**

Se espera aprobación del plan para iniciar implementación.