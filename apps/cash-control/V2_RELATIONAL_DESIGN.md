# Cash-Control v2 — Diseño de Arquitectura del Modelo Relacional

> **Documento:** V2_RELATIONAL_DESIGN.md  
> **Estado:** Especificación Definitiva de Arquitectura de Datos v2 (Autenticación, Identidad Operacional y Responsabilidad de Turno)  
> **Versión:** 1.5.0  
> **Rama de trabajo:** `v2/clean-core`  
> **Fecha:** Octubre 2026  
> **Especificación Conceptual de Referencia:** `V2_DOMAIN_SPEC.md` (v2.3.0)  
> **Regla Absoluta:** Este documento define las entidades, cardinalidades, invariantes matemáticas, modelo de permisos y reglas de integridad transaccional. **NO constituye código SQL ejecutable ni migración aplicada.**

---

## 1. Módulos y Catálogo Propuesto de Entidades (23 Entidades)

El modelo relacional se organiza en **6 módulos funcionales desacoplados**, estructurados en torno al principio de **Hecho Financiero Único (Journal)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ MÓDULO 1: NEGOCIO, SEGURIDAD Y ESTACIONES DE TRABAJO                   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. businesses               - Tenencia multi-sucursal / empresa        │
│ 2. workstations             - Puntos físicos de mostrador/ventanilla   │
│ 3. business_members         - Miembros del negocio, roles y PIN seguro │
│ 4. audit_events             - Bitácora forense append-only de seguridad│
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MÓDULO 2: TURNOS Y CUSTODIA OPERATIVA (DESACOPLADO DE CORTES)          │
├────────────────────────────────────────────────────────────────────────┤
│ 5. shifts                   - Intervalos de jornada y custodia humana  │
│ 6. shift_participants       - Operadores y rol en turno (responsible)  │
│ 7. custody_handovers        - Entregas-recepciones bilaterales con PIN │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MÓDULO 3: OPERACIONES CON CLIENTES Y CORRECCIONES                      │
├────────────────────────────────────────────────────────────────────────┤
│ 8. commission_rules         - Tarifarios inmutables versionados        │
│ 9. operations               - Depósitos y retiros canónicos de cliente │
│ 10. operation_corrections   - Vínculo inmutable de reversión/reemplazo │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MÓDULO 4: EL LIBRO MAYOR (JOURNAL Y DOS LEDGERS DIMENSIONALES)         │
├────────────────────────────────────────────────────────────────────────┤
│ 11. treasury_resources      - Cajas físicas y cuentas bancarias        │
│ 12. administrative_movements- Fondeos, gastos, transferencias, capital │
│ 13. journal_entries         - EL HECHO FINANCIERO ÚNICO (Raíz atómica) │
│ 14. financial_ledger_entries- Dimensión Tesorería Líquida (Activos)    │
│ 15. economic_ledger_entries - Dimensión Económica / P&L y Patrimonio   │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MÓDULO 5: CORTE INTEGRADO Y AUDITORÍA (INDEPENDIENTE DE TURNOS)        │
├────────────────────────────────────────────────────────────────────────┤
│ 16. cuts                    - Evento formal de corte y auditoría       │
│ 17. cut_audited_shifts      - Relación muchos a muchos: cortes y turnos│
│ 18. cut_cash_counts         - Arqueos físicos de charola y sobres      │
│ 19. bank_audits             - Actas de corte y saldo observado en banco│
│ 20. bank_audit_items        - Auditoría movimiento a movimiento (OTRO) │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ MÓDULO 6: INCIDENCIAS, RESULTADO ECONÓMICO Y PATRIMONIO                │
├────────────────────────────────────────────────────────────────────────┤
│ 21. chart_of_accounts       - Cuentas de P&L, patrimonio y transitoria │
│ 22. incidences              - Control permanente de faltantes/sobrantes│
│ 23. incidence_resolutions   - Historial de eventos y resoluciones      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. El Hecho Financiero Único: Journal y Dos Ledgers

### 2.1 Principio de Integridad Atómica
Un hecho financiero (depósito, retiro, gasto, ajuste de corte, reintegro, regularización) es un **evento indivisible en el mundo real**. Para erradicar asientos huérfanos y asegurar trazabilidad absoluta, se define la entidad superior **`journal_entries`**:

```text
                           HECHO FINANCIERO (journal_entries)
                                           │
            ┌──────────────────────────────┴──────────────────────────────┐
            ↓                                                             ↓
   DIMENSIÓN TESORERÍA                                           DIMENSIÓN ECONÓMICA
(financial_ledger_entries)                                     (economic_ledger_entries)
  - Caja física charola                                          - Comisiones ganadas
  - Sobres de apartados (retiros)                                - Gastos operativos
  - Cuentas bancarias (BBVA, Azteca, MP)                         - Pérdidas operativas dictaminadas
                                                                 - Capital aportado por dueño
                                                                 - Retiros de utilidades del dueño
                                                                 - CUSTODY_DISCREPANCY_SUSPENSE
```

### 2.2 Composición Flexible de Líneas por Tipo de Hecho
Un `journal_entry` representa la raíz del hecho y **permite explícitamente tres tipologías de composición sin obligar a crear líneas ficticias de $0**:
1. **Solamente Líneas Financieras ($N \ge 2$, $M = 0$):**
   - Hechos de simple reubicación de tesorería sin impacto en el patrimonio ni en el P&L.
   - *Ejemplo:* Transferencia interna Caja $\rightarrow$ Banco ($-\$5,000$ Caja, $+\$5,000$ Banco).
   - **Economía: 0 líneas (no se crean registros de $0).**
2. **Líneas Financieras y Líneas Económicas ($N \ge 1$, $M \ge 1$):**
   - Hechos mixtos donde el movimiento de dinero líquido genera o consume valor económico o patrimonial.
   - *Ejemplos:* Depósitos de clientes con cobro de comisión, gastos operativos pagados de caja, inyecciones de capital del dueño, cortes con diferencias de arqueo.
3. **Solamente Líneas Económicas ($N = 0$, $M \ge 2$):**
   - Hechos de reclasificación o dictámenes contables donde la tesorería física ya fue ajustada previamente y no debe volver a modificarse.
   - *Ejemplos:* Dictamen de pérdida confirmada de un faltante previo (Débito `EXP_CONFIRMED_LOSSES` $+\$200$, Crédito `CUSTODY_DISCREPANCY_SUSPENSE` $-\$200$), o regularizaciones de auditoría (`AUDIT_RECLASSIFICATION`) de dinero ya contado.
   - **Tesorería: 0 líneas (no se crean asientos financieros ficticios de $0).**

---

## 3. Invariante de Conservación del Hecho Financiero (Partida Doble)

> **Declaración Formal:** La regla $\sum \text{Débitos} \equiv \sum \text{Créditos}$ es la **"Invariante de Conservación del Hecho Financiero de Cash-Control"**. No pretende constituir por sí sola un sistema contable fiscal o estatutario general, sino garantizar matemáticamente que ningún centavo desaparezca o aparezca sin causa dentro del ecosistema operativo de Cash-Control.

### 3.1 Cuadre Matemático Universal
La invariante se evalúa a través de todas las líneas hijas emitidas por el **`journal_entry`**:

$$\sum_{f \in \text{financial\_ledger}} \text{signed\_cents}(f) + \sum_{e \in \text{economic\_ledger}} \text{signed\_cents}(e) = 0$$

Donde:
* **Valores Positivos (+ / Débito):** Aumentos de Activos de Tesorería, Aumentos de Gastos/Pérdidas, Aumentos de Activos Transitorios de Custodia, Retiros de Utilidades del Dueño.
* **Valores Negativos (- / Crédito):** Disminuciones de Activos de Tesorería, Aumentos de Ingresos (Comisiones), Aumentos de Capital del Dueño, Cancelación de Cuentas Transitorias.

---

## 4. Demostración Matemática y Contrapartidas de `AUDIT_RECLASSIFICATION`

Se formaliza la cuenta transitoria acotada **`CUSTODY_DISCREPANCY_SUSPENSE`** (subcuenta de control en `chart_of_accounts`), definiendo rigurosamente las contrapartidas obligatorias en cada escenario de auditoría.

> **Regla Fundamental de No Duplicación:** *Si el dinero ya estaba físicamente incluido en el saldo anterior verificado en corte, la reclasificación histórica NO puede volver a aumentar o disminuir la tesorería por ese mismo dinero.*

### 4.1 Demostración Exhaustiva por Caso Real

#### Caso A: Depósito de cliente ya incluido físicamente en caja pero no registrado
* **Hecho Físico Real:** Un cliente acudió a la sucursal y entregó en ventanilla $\$1,050$ en efectivo ($\$1,000$ a depositar en su cuenta bancaria $+$ $\$50$ de comisión en efectivo). La empresa realizó la transferencia bancaria de $\$1,000$ desde su cuenta bancaria hacia la cuenta del cliente. El cajero omitió registrar la operación en Cash-Control.
* **Saldos ya reconocidos en corte previo:**
  - En corte de caja: se detectó un sobrante físico de $+\$1,050$ en charola.  
    *Asiento de corte caja:* Débito Caja Física $+\$1,050$, Crédito `CUSTODY_DISCREPANCY_SUSPENSE` $-\$1,050$.
  - En corte de banco: se detectó un faltante de $-\$1,000$ en la cuenta bancaria por la transferencia salida.  
    *Asiento de corte banco:* Crédito Banco $-\$1,000$, Débito `CUSTODY_DISCREPANCY_SUSPENSE` $+\$1,000$.
  - Saldo acumulado en `CUSTODY_DISCREPANCY_SUSPENSE`: $-\$1,050 + \$1,000 = -\$50$ (saldo acreedor por la comisión ganada pendiente de asociar).
* **Asiento de Regularización (`origin = 'AUDIT_RECLASSIFICATION'`):**
  - `financial_ledger`: **0 líneas** (la caja física ya tiene los $\$1,050$ y el banco ya tiene descontados los $\$1,000$ en sus saldos reales; no se tocan).
  - `economic_ledger`:
    - Débito `CUSTODY_DISCREPANCY_SUSPENSE` $+\$50$ (cancela el saldo acreedor en suspenso).
    - Crédito `REV_COMMISSIONS` $-\$50$ (reconoce el ingreso ganado por comisión).
* **Impacto Neto sobre Treasury:** **Strictly $0$** (cero modificación de saldos operativos).
* **Impacto Económico:** $+\$50$ de utilidad por comisión.
* **Ecuación del Journal:** $\text{Financial } (0) + \text{Economic } (+\$50 - \$50 = 0) = 0$.
* **Estado de Suspense:** Queda en $\$0$ (resuelve simultáneamente las incidencias de ambos cortes).

#### Caso B: Retiro/pago de cliente cuyo dinero ya estaba incluido en el saldo pero no estaba registrado
* **Hecho Físico Real:** Un cliente transfirió por SPEI $\$525$ a la cuenta bancaria de la empresa ($\$500$ de retiro de efectivo $+$ $\$25$ de comisión). El cajero le entregó $\$500$ en efectivo de la charola. El cajero omitió registrar el ticket en el sistema.
* **Saldos ya reconocidos en corte previo:**
  - En corte de caja: se detectó un faltante de $-\$500$ (dinero entregado al cliente).  
    *Asiento de corte caja:* Crédito Caja Física $-\$500$, Débito `CUSTODY_DISCREPANCY_SUSPENSE` $+\$500$.
  - En corte de banco: se detectó un sobrante de $+\$525$ (SPEI recibido).  
    *Asiento de corte banco:* Débito Banco $+\$525$, Crédito `CUSTODY_DISCREPANCY_SUSPENSE` $-\$525$.
  - Saldo acumulado en `CUSTODY_DISCREPANCY_SUSPENSE`: $+\$500 - \$525 = -\$25$ (saldo acreedor por la comisión).
* **Asiento de Regularización (`origin = 'AUDIT_RECLASSIFICATION'`):**
  - `financial_ledger`: **0 líneas** (los recursos de caja y banco ya reflejan la realidad física en sus saldos actuales).
  - `economic_ledger`:
    - Débito `CUSTODY_DISCREPANCY_SUSPENSE` $+\$25$ (cancela el suspenso).
    - Crédito `REV_COMMISSIONS` $-\$25$ (reconoce la comisión ganada).
* **Impacto Neto sobre Treasury:** **Strictly $0$**.
* **Impacto Económico:** $+\$25$ de utilidad por comisión.
* **Ecuación del Journal:** $\text{Financial } (0) + \text{Economic } (+\$25 - \$25 = 0) = 0$.
* **Estado de Suspense:** Queda en $\$0$.

#### Caso C: Servicio cobrado en efectivo ya incluido físicamente en caja pero no registrado
* **Hecho Físico Real:** Un cliente pagó $\$300$ en efectivo por una comisión directa o servicio en ventanilla (sin banco). El cajero guardó los $\$300$ en la charola y no creó el ticket.
* **Saldos ya reconocidos en corte previo:**
  - En corte de caja: se detectó un sobrante físico de $+\$300$.  
    *Asiento de corte caja:* Débito Caja Física $+\$300$, Crédito `CUSTODY_DISCREPANCY_SUSPENSE` $-\$300$.
* **Asiento de Regularización (`origin = 'AUDIT_RECLASSIFICATION'`):**
  - `financial_ledger`: **0 líneas** (la caja física ya tiene los $\$300$ en su saldo real; prohibido volver a sumar).
  - `economic_ledger`:
    - Débito `CUSTODY_DISCREPANCY_SUSPENSE` $+\$300$ (cancela el pasivo contingente en suspenso).
    - Crédito `REV_COMMISSIONS` $-\$300$ (reconoce el ingreso ganado por el servicio).
* **Impacto Neto sobre Treasury:** **Strictly $0$**.
* **Impacto Económico:** $+\$300$ de ingreso/utilidad.
* **Ecuación del Journal:** $\text{Financial } (0) + \text{Economic } (+\$300 - \$300 = 0) = 0$.
* **Estado de Suspense:** Queda en $\$0$.

---

## 5. Protocolo Obligatorio de Bloqueo de Recursos y Concurrencia

### 5.1 Invariante de Bloqueo Exclusivo de Recursos
> **Regla de Oro:** *"Toda operación financiera que modifique un `treasury_resource` debe adquirir `FOR UPDATE` sobre ese recurso ANTES de insertar/modificar cualquier `financial_ledger_entry` o alterar `current_balance_cents`."*

Este protocolo es obligatorio para:
1. Registro de operaciones de ventanilla (depósitos y retiros).
2. Transferencias internas (bloqueando ambos recursos en orden determinista: `ORDER BY id ASC` para evitar deadlocks).
3. Finalización de cortes (`FINALIZE_CUT`).
4. Reintegros físicos de dinero.
5. Movimientos administrativos (fondeos, gastos, capital, retiros de utilidades).
6. Correcciones y reversiones.

### 5.2 Garantía de Serialización entre `FINALIZE_CUT` y `REGISTER_OPERATION`
Al imponer que ambas transacciones adquieran `SELECT ... FROM treasury_resources WHERE id = R FOR UPDATE;` como su primera sentencia, PostgreSQL **serializa estrictamente su ejecución**:
$$TX_{\text{corte}} \longrightarrow TX_{\text{operación}} \quad \text{o bien} \quad TX_{\text{operación}} \longrightarrow TX_{\text{corte}}$$
Es físicamente imposible que dos transacciones modifiquen simultáneamente el saldo o intercalen asientos de ledger para el mismo recurso.

### 5.3 Snapshot Consistente en Fase 1
Para garantizar que `snapshot_sequence` y `snapshot_expected_cents` representen exactamente el mismo estado lógico del recurso sin mantener bloqueos prolongados durante los 15 minutos de arqueo manual:
- Se realiza **una sola lectura atómica dentro de una sentencia SQL consistente**:
  ```text
  SELECT current_balance_cents, last_entry_sequence
  FROM treasury_resources
  WHERE id = R;
  ```
- Bajo el modelo MVCC de PostgreSQL, una sentencia `SELECT` evalúa un único snapshot transaccional inmutable. Ambos valores pertenecen con certeza absoluta al mismo estado lógico.

### 5.4 Generación Concurrente Segura de `entry_sequence`
`entry_sequence` **NO se genera mediante un `MAX() + 1` desprotegido**.
- Dado que la transacción ya tiene adquirido el lock exclusivo `FOR UPDATE` sobre `treasury_resources`:
  1. Lee la columna `treasury_resources.last_entry_sequence`.
  2. Calcula: `new_sequence = last_entry_sequence + 1`.
  3. Inserta en `financial_ledger_entries` con `entry_sequence = new_sequence`.
  4. Actualiza `treasury_resources SET last_entry_sequence = new_sequence, current_balance_cents = new_balance`.
- **Garantía:** Secuencia estrictamente monótona creciente (1, 2, 3...), sin huecos por rollback ajenos, sin colisiones y con costo computacional $O(1)$.

---

## 6. Simulación de Carrera Concurrente (Prueba de Estrés)

### Escenario Simulado:
* **T0 (18:00:00):** Saldo Caja Física #1 $= \$10,000$ (`current_balance_cents = 1000000`, `last_entry_sequence = 100`).
* **T1 (18:05:00):** Inicia corte ($TX_{\text{init}}$).
  - Snapshot atómico: `snapshot_sequence = 100`, `snapshot_expected_cents = 1000000` ($\$10,000$).
  - Inserta en `cuts`: `status = 'IN_PROGRESS'`. $TX_{\text{init}}$ comitea en 3 ms.
  - Caja queda libre. Auditor cuenta físicamente los billetes que estaban a las 18:05.
* **T2 (18:07:00):** Entra depósito de $\$500$ ($TX_{\text{dep1}}$).
  - Adquiere lock `FOR UPDATE` en Caja #1.
  - Lee `last_entry_sequence = 100`. Asigna `entry_sequence = 101`.
  - Inserta ledger: `amount = +500`, `balance_after = 10500`.
  - Actualiza Caja #1: `current_balance = 10500`, `last_entry_sequence = 101`.
  - Comitea. Cajero coloca los $\$500$ en la bandeja auxiliar "En Tránsito".
* **T3 (18:14:00):** Auditor termina conteo físico de la charola de las 18:05.
  - Conteo: $\$10,000$. Captura en UI: `counted_cents = 1000000`.
* **T4 y T5 (18:15:00.000):** Auditor intenta cerrar corte ($TX_{\text{cut}}$) y simultáneamente entra depósito de $\$200$ ($TX_{\text{dep2}}$).

---

### Análisis de la Carrera en el Momento del Lock:

#### Caso 1: $TX_{\text{cut}}$ adquiere `FOR UPDATE` primero
1. $TX_{\text{cut}}$ obtiene el lock exclusivo de Caja #1.
2. $TX_{\text{dep2}}$ intenta `SELECT ... FOR UPDATE` y **queda en espera (bloqueada)**.
3. $TX_{\text{cut}}$ consulta operaciones concurrentes:
   `WHERE resource_id = Caja_1 AND entry_sequence > 100`.
   - Encuentra: 1 operación (Depósito 1 de $\$500$, `sequence = 101`).
   - El auditor reportó conteo estricto del snapshot (no mezcló bandeja en tránsito).
   - Cálculo:
     - `snapshot_expected_cents = 10000`.
     - `counted_cents = 10000`.
     - `diferencia = 10000 - 10000 = 0` (Exacto).
     - `cutoff_sequence = 100`.
     - `nuevo_saldo = counted ($10,000) + delta_concurrentes ($500) = $10,500`.
   - Actualiza `cuts`: `status = 'COMPLETED'`, `cutoff_sequence = 100`, `difference_cents = 0`.
   - $TX_{\text{cut}}$ hace COMMIT (duración 8 ms).
4. Al hacer commit, se libera el lock de Caja #1.
5. $TX_{\text{dep2}}$ despierta, toma el lock:
   - Lee: `last_entry_sequence = 101`, `current_balance_cents = 10500`.
   - Asigna `entry_sequence = 102`.
   - Inserta ledger: `amount = +200`, `balance_after = 10700`.
   - Actualiza Caja #1 a $\$10,700$ y `last_entry_sequence = 102`.
   - $TX_{\text{dep2}}$ hace COMMIT.
* **Resultado:**
  - `snapshot`: sequence 100, expected $\$10,000$.
  - `cutoff`: sequence 100.
  - `diferencia`: $\$0$.
  - `saldo actual final`: $\$10,700$.
  - Depósito 1 (seq 101) y Depósito 2 (seq 102): confirmados, pertenecientes al periodo posterior al corte.

#### Caso 2: $TX_{\text{dep2}}$ adquiere `FOR UPDATE` primero
1. $TX_{\text{dep2}}$ obtiene el lock exclusivo de Caja #1.
2. $TX_{\text{cut}}$ intenta `SELECT ... FOR UPDATE` y **queda en espera**.
3. $TX_{\text{dep2}}$ procesa el depósito de $\$200$:
   - Lee `last_entry_sequence = 101`, `current_balance_cents = 10500`.
   - Asigna `entry_sequence = 102`.
   - Inserta ledger: `amount = +200`, `balance_after = 10700`.
   - Actualiza Caja #1 a $\$10,700$ y `last_entry_sequence = 102`.
   - Hace COMMIT (duración 6 ms) y libera el lock.
4. $TX_{\text{cut}}$ despierta y adquiere el lock:
   - Consulta operaciones con `entry_sequence > 100`.
   - Encuentra: 2 operaciones (Depósito 1 de $\$500$ [seq 101] y Depósito 2 de $\$200$ [seq 102]). Total $\Delta = +\$700$.
   - Conteo estricto del snapshot a las 18:05:
     - `snapshot_expected_cents = 10000`.
     - `counted_cents = 10000`.
     - `diferencia = 10000 - 10000 = 0` (Exacto).
     - `cutoff_sequence = 100`.
     - `nuevo_saldo = counted ($10,000) + delta ($700) = $10,700`.
   - Actualiza `cuts`: `status = 'COMPLETED'`, `cutoff_sequence = 100`, `difference_cents = 0`.
   - Mantiene Caja #1 en $\$10,700$ (coincidente al centavo).
   - Hace COMMIT.
* **Resultado:** Idéntico matemáticamente. Cero inconsistencias, cero dinero perdido.

---

## 7. Modelo de Seguridad, Autenticación e Identidad Operacional

### 7.1 Regla Fundamental: Supabase Auth vs. Identidad Operacional
* **Supabase Auth (`auth.users`):**
  - **SOLO el OWNER / DUEÑO tiene cuenta de Supabase Auth** con credenciales email/password.
  - La sesión web en el navegador de la workstation pertenece a la cuenta de Supabase Auth del dueño (`auth.uid()`).
  - **Los empleados (cajeros, encargados) NO tienen cuentas en Supabase Auth.** No existe un `auth.uid()` para empleados.
* **Identidad Operacional (`business_members`):**
  - Los empleados existen como perfiles operativos en la tabla `business_members` (`id`, `business_id`, `name`, `role`, `pin_hash`, `status`).
  - La identidad de quién realiza físicamente la acción en ventanilla se establece mediante `operator_member_id` y se valida con su **PIN criptográfico operacional salteado** (`pin_hash`).
  - El PIN identifica al operador físico en mostrador, pero **NO autentica una sesión de Supabase Auth**.
* **Trazabilidad Dual Obligatoria:**
  Todo registro financiero (`journal_entries`, `operations`, `cuts`, `audit_events`) almacena:
  - `auth_user_id`: UUID del dueño autenticado en Supabase Auth cuya sesión respalda la terminal.
  - `operator_member_id`: UUID del empleado en `business_members` que autorizó físicamente la transacción con su PIN en ventanilla.

### 7.2 Distinción entre Rol Permanente y Responsabilidad de Turno
Se erradica cualquier confusión entre cargos laborales y asignaciones de jornada:
* **`business_members.role` (Cargo y Capacidad Permanente):**
  - Valores permitidos: `owner`, `manager`, `cashier`.
  - Representa el rol contractual y permisos permanentes del miembro en la sucursal.
  - **`shift_responsible` NO es un rol de `business_members`**.
* **`shift_participants.role_in_shift` (Responsabilidad Temporal de Turno):**
  - Valores permitidos: `responsible`, `participant`.
  - Representa la custodia concreta asignada durante una jornada específica.
  - *Ejemplo:* Un empleado con cargo permanente `business_members.role = 'cashier'` puede ser el `role_in_shift = 'responsible'` en el turno matutino (responsable de la caja), y ser `role_in_shift = 'participant'` en el turno vespertino.

### 7.3 Flujo Obligatorio de Autorización en Funciones RPC (`SECURITY DEFINER`)
Toda función transaccional privilegiada debe ejecutar secuencialmente las siguientes comprobaciones de autorización antes de tocar el ledger:
1. **Comprobar Sesión Supabase:** `auth.uid() IS NOT NULL` (existe una sesión activa).
2. **Comprobar Tenencia del Dueño:** `auth.uid()` corresponde al owner registrado de la empresa (`businesses.owner_user_id = auth.uid()` o registro en `business_members` con `role = 'owner'`).
3. **Comprobar Alcance de Sucursal:** El `p_business_id` proporcionado está dentro del alcance legítimo de la sesión del dueño.
4. **Comprobar Pertenencia del Operador:** El `p_operator_member_id` pertenece a ese `p_business_id`.
5. **Comprobar Estado Activo:** `business_members.status = 'active'`.
6. **Validar PIN Operacional:** Se verifica que el PIN introducido coincida criptográficamente con el `pin_hash` de `operator_member_id`.
7. **Validar Capacidad Permanente:** El `business_members.role` del operador tiene permiso para esa operación.
8. **Validar Reglas de Turno y Custodia:** Si la operación requiere turno abierto (ej. depósitos/retiros), se comprueba que la workstation tenga un turno `OPEN` y que el operador esté registrado como participante activo en `shift_participants`.
9. **Fijación de Search Path Seguro:** `SET search_path = public, pg_temp;`.

### 7.4 Revocación Total de Privilegios de Escritura Directa
El esquema DDL ejecutará:
```text
REVOKE INSERT, UPDATE, DELETE ON public.journal_entries FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.financial_ledger_entries FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.economic_ledger_entries FROM authenticated, anon, public;
REVOKE UPDATE (current_balance_cents, last_entry_sequence) ON public.treasury_resources FROM authenticated, anon, public;
REVOKE UPDATE (unresolved_amount_cents) ON public.incidences FROM authenticated, anon, public;
```
* **Consecuencia:** La aplicación cliente, endpoints web o usuarios autenticados tienen **terminantemente prohibido** ejecutar un `INSERT` directo en el ledger o un `UPDATE` directo sobre el saldo de un recurso. Cualquier intento arrojará un error de privilegios de PostgreSQL (`permission denied`).

### 7.5 Matriz Definitiva de Roles, Responsabilidad y Permisos RPC

| Función RPC Transaccional (`SECURITY DEFINER`) | Capacidad Permanente Requerida (`business_members.role`) | Responsabilidad de Turno Requerida (`shift_participants.role_in_shift`) | Autenticación y Autorización Aplicada |
| :--- | :---: | :---: | :--- |
| `rpc_register_customer_operation` | `cashier`, `manager`, `owner` | Participante activo en el turno de la workstation | Sesión Supabase del Dueño + PIN del cajero + Turno `OPEN` |
| `rpc_transfer_internal` | `manager`, `owner` (o `cashier` autorizado) | Operador activo en turno | Sesión Supabase del Dueño + PIN operador + Validación de cuentas |
| `rpc_register_administrative_movement` | `manager`, `owner` (gastos menores: `cashier`) | Operador activo en turno | Sesión Supabase del Dueño + PIN operador + Comprobante |
| `rpc_owner_capital_or_drawing` | **Exclusivo `owner`** | N/A (Ámbito patrimonial del dueño) | **Sesión Supabase del Dueño + PIN del Dueño** |
| `rpc_initiate_cut` / `rpc_finalize_cut` | `manager`, `owner` (o `cashier` si es responsable) | **Responsable del turno (`role_in_shift = 'responsible'`)** | Sesión Supabase del Dueño + PIN del auditor/responsable |
| `rpc_resolve_incidence` (Reintegro) | `manager`, `owner` | N/A (Ámbito de administración) | Sesión Supabase del Dueño + PIN + Recibo formal |
| `rpc_resolve_incidence` (Pérdida/Sobrante Confirmado)| **Exclusivo `owner`** | N/A (Ámbito patrimonial del dueño) | **Sesión Supabase del Dueño + PIN del Dueño** |
| `rpc_correct_operation` | `manager`, `owner` | N/A (Supervisión) | Sesión Supabase del Dueño + PIN de supervisor |

---

## 8. Lista Definitiva de Invariantes del Sistema

1. **Lock Obligatorio de Recursos:** Ningún `financial_ledger_entry` ni `treasury_resources.current_balance_cents` puede crearse o modificarse sin haber adquirido primero `SELECT ... FOR UPDATE` sobre el `treasury_resource`.
2. **Secuencia Monótona sin Colisiones:** `entry_sequence` se genera dentro del lock exclusivo sobre `last_entry_sequence`, garantizando secuencia incremental estricta libre de colisiones.
3. **Snapshot Atómico Consistente:** `snapshot_sequence` y `snapshot_expected_cents` se obtienen mediante una única lectura atómica en MVCC, garantizando que pertenecen al mismo estado lógico.
4. **Saldo Materializado Idéntico al Ledger:**
   $$\text{treasury\_resources.current\_balance\_cents}[R] \equiv \sum_{e \in \text{financial\_ledger}(R)} (\text{direction} \cdot \text{amount\_cents})$$
5. **Integridad del Hecho Financiero (Journal):** Todo hecho financiero inserta en bloque atómico su cabecera en `journal_entries` y sus líneas correspondientes en los ledgers; ningún journal puede quedar parcialmente creado.
6. **Invariante de Conservación del Hecho Financiero de Cash-Control:**
   Para todo `journal_entry_id`: $\sum \text{financial\_ledger.signed} + \sum \text{economic\_ledger.signed} = 0$.
7. **Conciliación Estricta de Cuenta Transitoria:**
   $$\text{Saldo}(\text{CUSTODY\_DISCREPANCY\_SUSPENSE}) \equiv \sum_{i \in \text{incidences (activas)}} \text{direction}(i) \cdot \text{unresolved\_amount}(i)$$
8. **Protección de Monto Pendiente:** Prohibido el `UPDATE` directo sobre `incidences.unresolved_amount_cents`; solo los triggers de inserción en `incidence_resolutions` recalculan este valor. Restricción `CHECK (unresolved_amount_cents >= 0 AND unresolved_amount_cents <= original_amount_cents)`.
9. **Moneda Entera:** Todo monto monetario se almacena en centavos enteros (`BIGINT`), con restricción `CHECK (amount_cents >= 0)`.
10. **Inmutabilidad y Reversión:** Prohibido el `UPDATE` destructivo de montos, cuentas o comisiones en `operations`. Toda corrección emite reversión y reemplazo atómicos en `operation_corrections`.
11. **No Duplicación en Reclasificaciones:** Toda operación con `origin = 'AUDIT_RECLASSIFICATION'` emite asientos de tesorería cuyo impacto neto a la disponibilidad líquida es estrictamente $\$0$.
12. **Desacoplamiento de Turnos y Cortes:** Los turnos delimitan custodia humana; los cortes delimitan auditoría y verificación de recursos.
13. **Blindaje de Privilegios DDL:** Prohibido el acceso `INSERT/UPDATE` directo a ledgers y saldos desde roles de aplicación; escritura permitida exclusivamente vía funciones `SECURITY DEFINER`.
14. **Doble Trazabilidad del Actor:** Todo hecho financiero almacena indivisiblemente el `auth_user_id` de la sesión del dueño y el `operator_member_id` del empleado que autorizó con PIN.
