# Decisiones de arquitectura y diseño

---

## Decisión 001 — Eliminación del operador actual y nuevo modelo operativo

**Fecha:** 2026-07-21

**Contexto:**
El documento WORKSTATION.md definía un concepto de "operador actual" como la persona que utiliza la interfaz en un momento dado, almacenado como campo propio de la estación y representado mediante `isCurrentOperator` en los participantes. Este concepto generaba redundancia con la sesión autenticada y requería sincronización constante entre el estado de la sesión y el operador almacenado.

Adicionalmente, no existía una separación clara entre los conceptos de sesión autenticada, participación activa y responsabilidad. El modelo no distinguía entre un usuario que simplemente desbloquea la pantalla para consultar su perfil y un usuario que se incorpora activamente a la jornada operativa.

**Decisión tomada:**

1. **Eliminación del operador actual:** No existirá un campo `operator` ni `currentOperator` en la estación. No se usará `isCurrentOperator` en los participantes. El autor de cada operación es el usuario autenticado al momento de confirmarla.

2. **Separación sesión/participación/responsabilidad:** Estos tres conceptos son independientes entre sí:
   - La sesión indica quién tiene desbloqueada la pantalla.
   - La participación indica quién forma parte de la jornada.
   - La responsabilidad indica quién tiene a su cargo la caja.
   - Cada uno puede cambiar sin afectar a los otros.

3. **Pantalla exterior de acceso:** La pantalla de "Estación" o "Jornada" queda fuera del sistema interno y no aparece en el Sidebar. Funciona como pantalla de acceso y bloqueo, sin mostrar información financiera sensible.

4. **Bloqueo adaptativo:** El comportamiento de bloqueo automático se adapta según el número de participantes activos (modo individual vs. modo compartido).

5. **Prohibición de movimientos sin participación activa:** Las operaciones financieras requieren participación activa. Un usuario autenticado sin participación solo puede acceder a funciones no operativas.

**Documentos que reflejan esta decisión:**
- OPERATION_MODEL.md (nuevo documento, fuente principal para identidad, sesión y participación).
- WORKSTATION.md (actualizado para eliminar referencias al operador actual).

**Próximos pasos:**
- Actualizar types.ts y mockData.ts para eliminar `isCurrentOperator` y el campo `operator` de WorkstationData.
- Reemplazar ChangeOperatorModal por flujo de bloqueo/desbloqueo.
- Eliminar componentes obsoletos una vez que el nuevo flujo esté implementado.

---

## Decisión 002 — Separación definitiva entre autenticación e inicio de participación

**Fecha:** 2026-07-21

**Contexto:**
Inicialmente, el flujo de acceso desde la pantalla exterior combinaba la autenticación (validación de PIN) con el inicio de participación. Esto generaba confusión porque un usuario que deseaba simplemente acceder al sistema para consultar información no operativa (por ejemplo, cambiar su PIN) se convertía automáticamente en participante activo de la jornada.

Esta situación generaba problemas:
- Participantes fantasma que aparecían en la pantalla exterior sin haber realizado operaciones.
- Dificultad para distinguir entre "acceso al sistema" e "inicio de jornada operativa".
- Falta de claridad en el modelo: no era posible tener una sesión autenticada sin participación activa.

**Decisión tomada:**

1. **Autenticación sin participación:** El flujo de acceso desde la pantalla exterior solo desbloquea la sesión. No inicia participación automáticamente.

2. **Inicio de participación explícito:** La participación debe iniciarse mediante una acción explícita del usuario dentro del sistema (botón "Iniciar participación" en el Dashboard).

3. **Cambio de texto en pantalla exterior:** Se reemplazó "Incorporarme a la jornada" por "Entrar con otro usuario" para reflejar que este flujo es para autenticarse, no para participar.

4. **Eliminación del paso de confirmación:** Ya no existe el paso intermedio "Vas a incorporarte a la jornada como apoyo" / "Iniciar participación y entrar". Después del PIN correcto, el usuario entra directamente al sistema.

5. **Control de participación en Dashboard:** Se creó el componente `ParticipationControl` que muestra claramente el estado de participación y permite iniciarla o finalizarla.

6. **Restricción de operaciones:** Las páginas operativas (/deposits, /withdrawals, /pending-withdrawals) están protegidas por `ParticipationGuard`, que muestra un mensaje contextual si el usuario no tiene participación activa.

7. **Header actualizado:** El Header muestra el estado real de participación del usuario autenticado, consultando directamente la lista de participantes activos.

**Reglas implementadas:**
- Un usuario autenticado sin participación puede acceder al Dashboard pero no puede realizar operaciones.
- Al pulsar "Iniciar participación" desde el Dashboard, se crea una participación de tipo "support" con estado "active".
- Al finalizar participación (solo para apoyo), se cambia el estado a "ended" y se bloquea la sesión automáticamente.
- El responsable no puede finalizar su participación directamente; se muestra un mensaje explicativo.

**Documentos actualizados:**
- OPERATION_MODEL.md: Secciones 8, 9 y 10 actualizadas para reflejar la separación definitiva.
- docs/DECISIONS.md: Esta decisión.

**Próximos pasos:**
- Implementar el flujo de "Iniciar participación y continuar" cuando un usuario sin participación intenta acceder a una página operativa.
- Agregar validación en el resto de páginas operativas.
- Considerar si /history también debe estar protegida (actualmente se permite acceso de lectura).
