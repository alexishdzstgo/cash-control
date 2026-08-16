# Modelo operativo del sistema

> Documento principal para identidad, sesión y participación.
>
> **Versión:** 1.0
> **Fecha:** 2026-07-21
> **Relacionado con:** WORKSTATION.md

---

## 1. Objetivo

El modelo operativo descrito en este documento define cómo las personas acceden al sistema, inician su participación en la jornada, mantienen sesiones activas y asumen responsabilidad sobre las operaciones.

Su propósito fundamental es permitir que varias personas utilicen una computadora compartida (estación) sin perder la identidad de quien realiza cada acción, manteniendo un acceso rápido y adecuado al funcionamiento real del negocio.

El modelo no es una especificación de base de datos ni una implementación técnica. Es la fuente conceptual que debe guiar cualquier implementación de autenticación, sesión, participación y control de acceso.

---

## 2. Principios fundamentales

1. **El acceso debe ser rápido.** Un usuario con participación activa debe poder desbloquear su sesión en segundos, sin formularios extensos ni pasos innecesarios.

2. **Cada acción debe atribuirse al usuario correcto.** Toda operación registrada en el sistema debe poder asociarse sin ambigüedad a la persona que la confirmó.

3. **Bloquear sesión no significa dejar de trabajar.** Bloquear la pantalla protege la información y permite que otra persona use la computadora, pero no finaliza la participación del usuario en la jornada.

4. **Iniciar sesión no significa incorporarse automáticamente a la jornada.** Un usuario puede autenticarse únicamente para consultar su perfil o cambiar su PIN, sin que eso lo convierta en participante activo.

5. **La responsabilidad es independiente de la sesión y de la participación.** Una persona puede ser responsable aunque su sesión esté bloqueada. La responsabilidad no se gana ni se pierde por iniciar o cerrar sesión.

6. **El sistema debe reducir fricción sin ocultar quién está usando la cuenta.** La rapidez no debe sacrificar la trazabilidad. Un cambio rápido de persona debe seguir registrando correctamente quién realizó cada operación.

7. **El sistema documenta la realidad y no inventa estados automáticamente.** No debe asumir que un usuario inició o finalizó su participación porque bloqueó o desbloqueó su sesión. Los cambios de estado deben ser acciones explícitas del usuario.

---

## 3. Conceptos fundamentales

### Usuario registrado

Persona previamente dada de alta en el sistema con nombre completo, estado (activo/inactivo), conjunto de permisos y PIN.

El usuario registrado es la entidad base del modelo. Sin un usuario registrado no puede existir sesión, participación ni responsabilidad.

### Sesión autenticada

Estado en el que un usuario registrado tiene actualmente desbloqueado el acceso al sistema.

Una sesión autenticada permite al usuario interactuar con la interfaz del sistema según sus permisos y según si tiene o no una participación activa.

Características:
- Solo puede existir una sesión desbloqueada por estación.
- La sesión pertenece a un único usuario.
- La sesión puede bloquearse (manual o automáticamente) sin perder la identidad del usuario.

### Participación

Registro de que un usuario forma parte de la jornada operativa actual.

La participación no es un estado técnico de sesión. Es un registro de jornada que indica que la persona está trabajando o disponible para trabajar en la estación.

Una participación almacena:
- usuario;
- estación;
- jornada;
- fecha y hora de inicio;
- fecha y hora de finalización (si aplica);
- tipo (responsable o apoyo);
- estado (activa o finalizada).

### Participante activo

Usuario cuya participación comenzó y todavía no ha finalizado.

Un participante activo puede:
- tener la sesión desbloqueada o bloqueada;
- ser el responsable o ser apoyo;
- aparecer en la pantalla exterior como persona que está trabajando.

### Responsable

Participante que tiene formalmente a su cargo la caja y los saldos de la estación.

Solo puede existir un responsable vigente por estación.

La responsabilidad es independiente de la sesión y de la participación.
Un responsable puede tener su sesión bloqueada y seguir siendo responsable.
Para dejar de ser responsable debe ocurrir un evento explícito (entrega-recepción, recuperación extraordinaria o cierre).

### Estación

Computadora o punto físico compartido desde el que se realizan operaciones.

La estación es el contexto operativo del modelo. Todos los eventos, participaciones y operaciones ocurren dentro de una estación.

### Jornada operativa

Periodo durante el cual la estación se encuentra abierta y puede recibir operaciones.

La jornada comienza con la apertura de la estación y termina con su cierre.
Dentro de una jornada pueden ocurrir múltiples participaciones, cambios de responsable, entregas-recepciones, recuperaciones y operaciones.

---

## 4. Independencia entre estados

Uno de los pilares del modelo es que los estados de sesión, participación y responsabilidad son independientes entre sí.

### Ejemplos de independencia

| Sesión | Participación | Responsable | Escenario |
|--------|--------------|-------------|-----------|
| Desbloqueada | Sin participación | No | Usuario consulta su perfil. |
| Bloqueada | Activa | Sí | Responsable bloquea la pantalla para ir a la bodega. |
| Bloqueada | Activa | No | Apoyo bloquea la pantalla al retirarse momentáneamente. |
| Desbloqueada | Activa | Sí | Responsable registrando operaciones. |
| Desbloqueada | Activa | No | Apoyo registrando operaciones bajo la responsabilidad de otro. |

### Reglas de independencia

- Un usuario puede estar autenticado sin participación activa.
- Un participante puede estar activo aunque su sesión esté bloqueada.
- Un participante activo puede ser apoyo o responsable.
- Solo puede existir un responsable vigente por estación.
- El usuario autenticado no se convierte automáticamente en responsable.
- El responsable no tiene que mantener su sesión abierta permanentemente.

---

## 5. Eliminación del concepto operador actual

El modelo anterior definía un "operador actual" como la persona que está usando la computadora en un momento dado. Este concepto queda eliminado.

### Reglas establecidas

- **No existirá un operador actual almacenado en la estación.**
  La estación no tendrá un campo `operator` ni `currentOperator`.

- **No se usará `isCurrentOperator`.**
  Ningún participante tendrá una propiedad que indique si es el operador actual.

- **El autor de una operación será el usuario autenticado al momento de confirmarla.**
  Cuando un usuario confirma una operación (depósito, retiro, etc.), el sistema registra como autor al usuario que tiene la sesión desbloqueada en ese instante.

- **Para cambiar de persona se debe bloquear la sesión y autenticar al siguiente usuario.**
  No existe un "cambio de operador" como acción separada. El cambio ocurre porque:
  1. El usuario actual bloquea su sesión.
  2. El siguiente usuario selecciona su perfil e introduce su PIN.
  3. La sesión se desbloquea para el nuevo usuario.

- **Cambiar de sesión no inicia ni finaliza participaciones.**
  Bloquear la sesión de un participante activo no finaliza su participación. Desbloquear la sesión de otro usuario no inicia automáticamente una participación nueva.

### Justificación

El concepto de operador actual era redundante: duplicaba la información que ya proporciona la sesión desbloqueada. Mantenerlo requería sincronización constante y añadía complejidad sin beneficio real.

---

## 6. Pantalla exterior de acceso

La pantalla actualmente denominada "Estación" o "Jornada" en la interfaz visual tiene las siguientes características:

### Ubicación y acceso

- Está **fuera del sistema interno**. Es la primera pantalla que ve el usuario al cargar la aplicación.
- **No aparece en el Sidebar.** No es una página navegable dentro del sistema.
- Funciona como **pantalla de acceso y bloqueo**.

### Contenido visual

La pantalla exterior es pública en el sentido de que cualquier persona puede verla al acercarse a la computadora. Por lo tanto:

**Información permitida:**
- Nombre de la estación.
- Estado de la jornada (abierta/cerrada).
- Responsable actual.
- Participantes activos (nombres, desde cuándo están).
- Estado general no sensible (por ejemplo: confiable, con observaciones).

**Información no permitida:**
- Saldos.
- Folios.
- Datos bancarios.
- Montos.
- Diferencias detalladas.
- Historial financiero.

### Funcionalidad

La pantalla exterior permite:
- Mostrar primero a los participantes activos (ordenados por antigüedad, con el responsable destacado).
- Seleccionar un perfil existente (participante activo) y escribir el PIN para desbloquear.
- Iniciar una nueva participación (incorporarse a la jornada).
- Distinguir visualmente entre "regresar al sistema" (perfil ya activo) e "incorporarse por primera vez".

---

## 7. Acceso de un participante activo

Cuando un usuario ya tiene una participación activa en la jornada actual (por ejemplo, regresa después de bloquear la pantalla), el flujo es:

1. Selecciona su perfil en la pantalla exterior.
2. Introduce su PIN.
3. El sistema valida su identidad.
4. Se desbloquea su sesión.
5. Entra directamente al sistema.

**Este flujo no vuelve a iniciar su participación.** La participación ya existe y continúa activa.

El flujo debe ser rápido: perfil + PIN + entrada. No debe solicitar confirmación adicional ni preguntar si desea iniciar participación.

---

## 8. Incorporación de un usuario

Cuando un usuario registrado no tiene una participación activa y desea incorporarse a la jornada:

1. Selecciona "Entrar con otro usuario" en la pantalla exterior.
2. Selecciona un usuario registrado que no esté activo actualmente.
3. Introduce su PIN.
4. Se desbloquea su sesión **sin iniciar participación**.
5. El usuario entra al sistema autenticado pero **sin participación activa**.
6. Desde el Dashboard, el usuario puede pulsar "Iniciar participación" para incorporarse formalmente a la jornada.
7. Al iniciar participación, se registra la hora de inicio.
8. El usuario ingresa inicialmente como **apoyo**, salvo que exista una regla autorizada distinta (por ejemplo, si es el único usuario y debe abrir la estación como responsable).
9. Aparece entre los participantes activos en la pantalla exterior.

La incorporación no cambia al responsable ni afecta la sesión de otros participantes.

**Importante:** La autenticación (desbloqueo de sesión) y el inicio de participación son acciones independientes. Un usuario puede autenticarse sin participar, por ejemplo para consultar su perfil o cambiar su PIN.

---

## 9. Usuario autenticado sin participación

Un usuario puede tener la sesión desbloqueada sin tener una participación activa. Esto ocurre cuando el usuario se autentica pero aún no ha iniciado su participación formal en la jornada.

### Acciones permitidas

- Ver y editar su propio perfil (nombre, datos de contacto, preferencias).
- Cambiar su PIN.
- Consultar sus propios permisos.
- Bloquear su sesión.
- Acceder al Dashboard.
- Iniciar su participación desde el Dashboard.

### Acciones NO permitidas

- Registrar depósitos.
- Registrar retiros.
- Entregar retiros.
- Editar, cancelar o eliminar operaciones.
- Generar acciones financieras.
- Realizar cortes.
- Aceptar o entregar responsabilidad.
- Cerrar la estación.

Cualquier intento de realizar estas acciones debe mostrar un mensaje contextual explicando que debe iniciar participación, y ofrecer la opción de hacerlo en ese momento.

---

## 10. Inicio de participación por intención

Si un usuario autenticado sin participación activa intenta realizar una acción operativa (por ejemplo, hacer clic en "Registrar depósito"), el sistema no debe mostrar únicamente un mensaje genérico de "Acceso denegado".

Debe ofrecer un mensaje contextual como:

> "Para realizar esta acción debes incorporarte a la jornada actual."

Y presentar dos opciones:
- **Iniciar participación y continuar.** El sistema ejecuta el flujo de incorporación (sección 8) y, al completarse exitosamente, redirige al usuario hacia la acción original que intentaba realizar.
- **Cancelar.** El sistema no realiza cambios y regresa al estado anterior.

Este flujo evita la frustración del usuario y mantiene la integridad del modelo: la operación nunca se confirma sin una participación activa, pero el sistema guía al usuario para que pueda completar su tarea.

---

## 11. Bloqueo manual

El bloqueo manual es la acción explícita de proteger la pantalla.

### Reglas

- Debe existir un botón o control visible con la etiqueta **"Bloquear"** (o un icono reconocible de candado).
- Bloquear regresa a la pantalla exterior.
- Bloquear elimina el acceso visual a información sensible (saldos, operaciones, datos financieros).
- **Bloquear no finaliza la participación.**
- **Bloquear no cambia al responsable.**
- **Bloquear no cierra la jornada.**
- Otro usuario puede seleccionar su perfil e introducir su PIN para desbloquear la sesión.

### Sobre el texto "Cerrar sesión"

No debe usarse el texto "Cerrar sesión" para la acción cotidiana de bloquear la pantalla si puede confundirse con finalizar la participación. En caso de que exista una acción real de "Cerrar sesión" (por ejemplo, para salir completamente del sistema en un navegador compartido), debe estar claramente diferenciada del bloqueo.

---

## 12. Bloqueo automático adaptativo

El sistema debe poder bloquear la sesión automáticamente después de un periodo de inactividad. El comportamiento se adapta según el contexto:

### Modo individual

Cuando existe una sola participación activa en la estación.

**Opciones:**
- Mantener sesión abierta (nunca bloquear automáticamente).
- Bloquear después de un tiempo configurable (por ejemplo: 5, 10, 15, 30 minutos).

### Modo compartido

Cuando existen dos o más participaciones activas en la estación.

**Opciones:**
- Bloqueo después de 2, 5, 10 o 30 minutos de inactividad.
- Mantener abierta con advertencia explícita (el usuario debe confirmar que desea mantener la sesión desbloqueada).

### Política por usuario y estación

La preferencia de bloqueo puede pertenecer al usuario para una estación determinada. Por ejemplo, Alexis puede tener configurado "mantener abierta" para la caja principal, mientras que Juan puede tener "bloquear después de 5 minutos" para la misma estación.

Cuando un usuario desbloquea la sesión, se aplica su preferencia según el modo actual (individual o compartido).

---

## 13. Cambio dinámico del modo de sesión

El modo (individual o compartido) puede cambiar durante la jornada según el número de participantes activos.

### Ejemplo

1. Alexis es el único participante activo. Tiene configurado "mantener abierta" en modo individual.
2. Juan inicia participación (ahora hay dos activos).
3. El sistema cambia automáticamente al modo compartido.
4. El sistema informa a Alexis: "Juan ha iniciado participación. Se aplicará bloqueo por inactividad en modo compartido."
5. No bloquea la sesión inmediatamente. Solo cambia la política para futuros bloqueos.
6. Si más tarde Juan finaliza su participación y Alexis queda solo nuevamente, el sistema recupera su preferencia individual.

### Reglas

- El cambio de modo no bloquea la sesión activa.
- El cambio de modo debe informarse al usuario afectado.
- Al volver al modo individual, se restaura la preferencia individual del usuario actual.

---

## 14. Advertencia por inactividad

Antes de ejecutar el bloqueo automático, el sistema puede mostrar una advertencia:

- Una cuenta regresiva visual (por ejemplo, 30 segundos).
- Opciones:
  - **Continuar trabajando** (reinicia el temporizador de inactividad).
  - **Bloquear ahora** (ejecuta el bloqueo manual inmediatamente).

### Reglas

- Cualquier interacción válida (movimiento de ratón, teclado, clic en zona interactiva) puede reiniciar el temporizador.
- Los procesos delicados (una operación en curso, un formulario sin guardar) deben advertir antes de bloquear para evitar pérdida de información.
- El bloqueo automático nunca debe finalizar participaciones.

**Nota:** No se fija todavía un tiempo definitivo. Debe ser configurable por usuario, por estación o globalmente.

---

## 15. Finalización de participación

### Para un participante de tipo apoyo

1. El usuario pulsa "Finalizar participación" (disponible en la interfaz interna, no en la pantalla exterior).
2. El sistema solicita confirmación ("¿Confirmas que deseas finalizar tu participación?").
3. El usuario confirma.
4. Se registra la hora de finalización.
5. El usuario deja de aparecer como participante activo en la pantalla exterior.
6. Su sesión se bloquea automáticamente.
7. Regresa a la pantalla exterior.

La finalización de una participación de apoyo no afecta al responsable, a la estación ni a la jornada.

### Para un responsable

El responsable no puede finalizar su participación directamente.

Antes de finalizar debe ocurrir una de estas situaciones:
- **Entrega-recepción aceptada:** El responsable entrega formalmente la responsabilidad a otro participante.
- **Recuperación extraordinaria:** Una persona autorizada asume la responsabilidad debido a una emergencia.
- **Cierre de la estación:** Termina la jornada operativa.

Estas reglas se encuentran detalladas en **WORKSTATION.md**.

---

## 16. Acciones sensibles

Algunas acciones, por su impacto, deben solicitar nuevamente el PIN del usuario, incluso si la sesión ya está desbloqueada.

### Acciones que requieren revalidación

- Entregar responsabilidad.
- Aceptar o asumir responsabilidad.
- Cerrar la estación.
- Cancelar operaciones.
- Editar operaciones sensibles.
- Resolver diferencias.
- Cambiar configuraciones críticas.

### Reglas

- La revalidación no inicia una sesión nueva.
- La revalidación no cambia la participación.
- La revalidación solo confirma que la persona que está usando la computadora es realmente quien dice ser.
- El PIN se verifica contra el usuario autenticado actual.

---

## 17. Asociación de operaciones

Cada operación registrada en el sistema debe poder asociarse conceptualmente con las siguientes entidades:

| Elemento | Descripción |
|----------|-------------|
| **Usuario que la realizó** | El usuario que tenía la sesión desbloqueada al confirmar la operación. |
| **Participación activa del usuario** | La participación activa del usuario en el momento de la operación. Permite saber en qué contexto de jornada se registró. |
| **Responsable vigente** | El responsable de la estación al momento de crear la operación. Puede ser diferente del usuario que la registró. |
| **Estación** | La estación desde la que se registró la operación. |
| **Jornada** | La jornada operativa activa al momento de la operación. |
| **Fecha y hora** | Marca de tiempo de la confirmación. |

### Importante

No se define aquí la estructura de tablas SQL ni la implementación técnica. La relación es conceptual:
- Una operación tiene un autor (usuario autenticado).
- Un autor tiene una participación activa (o la operación no debería haberse permitido).
- Una participación pertenece a una estación y una jornada.
- Una estación tiene un responsable vigente.

---

## 18. Auditoría

El sistema debe registrar eventos relacionados con sesión, participación y acciones sensibles.

### Eventos a registrar

- **Sesión desbloqueada:** Cuándo y qué usuario desbloqueó la sesión.
- **Sesión bloqueada manualmente:** Cuándo y qué usuario bloqueó la sesión.
- **Sesión bloqueada por inactividad:** Cuándo y qué usuario fue bloqueado automáticamente.
- **Participación iniciada:** Cuándo y qué usuario inició su participación.
- **Participación finalizada:** Cuándo y qué usuario finalizó su participación.
- **Preferencia de sesión modificada:** Cuándo un usuario cambió su configuración de bloqueo automático.
- **Cambio de modo individual a compartido:** Cuándo el sistema detectó múltiples participantes y cambió la política.
- **Revalidación de identidad:** Cuándo un usuario reingresó su PIN para una acción sensible.

### Nota sobre visibilidad

No todos los eventos de sesión necesitan mostrarse en la actividad reciente del empleado o en la interfaz principal. Sin embargo, todos deben poder auditarse a través de un registro interno del sistema.

---

## 19. Casos de ejemplo

### Caso A: Empleado que llega

Alexis llega a trabajar. La estación está abierta.
1. En la pantalla exterior, selecciona "Incorporarme a la jornada".
2. Selecciona su perfil (Alexis).
3. Introduce su PIN.
4. Confirma el inicio de participación.
5. El sistema registra la hora de inicio.
6. Alexis ingresa como apoyo.
7. Su sesión se desbloquea.
8. Alexis comienza a registrar operaciones.

### Caso B: Regreso después de bloqueo

Alexis continúa con participación activa, pero había bloqueado su sesión.
1. En la pantalla exterior, selecciona su perfil (Alexis).
2. Introduce su PIN.
3. El sistema valida su identidad.
4. Su sesión se desbloquea.
5. Entra directamente al sistema.

Nota: Alexis no inicia una nueva participación. Su participación original sigue activa.

### Caso C: Empleado solo

Alexis es el único participante activo.
1. Alexis tiene configurado "mantener sesión abierta" en modo individual.
2. La sesión permanece desbloqueada durante toda su jornada.
3. Si Alexis se aleja de la computadora, debe bloquear manualmente.

### Caso D: Llega otro empleado

Juan inicia participación (ahora hay dos activos: Alexis y Juan).
1. El sistema detecta el cambio a modo compartido.
2. Muestra una notificación a Alexis: "Juan ha iniciado participación. Se aplicará bloqueo por inactividad en modo compartido."
3. No bloquea la sesión actual.
4. Cuando Alexis esté inactivo durante el tiempo configurado, se bloqueará su sesión automáticamente.

### Caso E: Usuario autenticado sin participar

Alexis quiere cambiar su PIN.
1. Desde la pantalla exterior, selecciona su perfil e introduce su PIN.
2. El sistema desbloquea su sesión, pero Alexis no tiene participación activa.
3. Alexis navega a la configuración de su perfil.
4. Cambia su PIN exitosamente.
5. Luego intenta registrar un depósito.
6. El sistema muestra: "Para realizar esta acción debes incorporarte a la jornada actual."
7. Alexis selecciona "Iniciar participación y continuar".
8. Completa su incorporación.
9. El sistema le muestra el formulario de depósito.

### Caso F: Salida del responsable

María es la responsable.
1. María necesita retirarse. No puede simplemente finalizar su participación.
2. Debe iniciar un proceso de entrega-recepción (detallado en WORKSTATION.md).
3. Alternativamente, si es una emergencia, alguien debe asumir la responsabilidad mediante una recuperación extraordinaria.
4. La estación no puede cerrar la participación de María sin resolver la responsabilidad primero.

---

## 20. Reglas no negociables

1. **Toda operación tiene un usuario autenticado como autor.** No puede existir una operación sin un usuario identificado.

2. **Sin participación activa no se crean ni modifican movimientos operativos.** Las operaciones financieras (depósitos, retiros, transferencias, cortes) requieren participación activa.

3. **Bloquear una sesión nunca finaliza una participación.** El bloqueo es solo un estado de acceso, no de jornada.

4. **Finalizar participación es una acción explícita.** No se deduce de bloqueos, aperturas de sesión ni inactividad.

5. **La responsabilidad nunca cambia por iniciar sesión.** Autenticarse no otorga ni quita responsabilidad.

6. **La responsabilidad nunca cambia por iniciar o finalizar una participación de apoyo.** Solo cambia mediante entrega-recepción, recuperación extraordinaria o cierre.

7. **No existe un operador actual almacenado.** La sesión desbloqueada es la única fuente de quién está usando la computadora.

8. **Un PIN pertenece a un usuario registrado.** No es una clave compartida ni genérica.

9. **Un usuario no puede mantener dos participaciones activas en la misma estación.** Si ya está activo, no puede iniciar otra participación hasta finalizar la anterior.

10. **Una sesión desbloqueada solo pertenece a un usuario.** No es posible mantener la sesión de dos personas al mismo tiempo.

11. **La pantalla exterior no muestra información financiera sensible.** Solo muestra datos operativos generales.

12. **Las acciones sensibles pueden exigir revalidación.** El sistema puede solicitar el PIN nuevamente sin cerrar la sesión ni cambiar la participación.

13. **Las operaciones confirmadas no cambian de autor aunque después cambie la sesión.** El autor queda fijado al momento de la confirmación.

14. **La rapidez de acceso no debe eliminar la identificación del usuario.** Los atajos para acelerar el flujo nunca deben omitir la verificación de identidad.

---

## 21. Alcance inicial

La primera versión del sistema debe implementar los siguientes elementos del modelo:

### Incluido en la primera versión

- [x] Selección de perfil en pantalla exterior.
- [x] Validación mediante PIN.
- [x] Bloqueo manual de sesión.
- [x] Participación activa (inicio, estado activo, finalización).
- [x] Incorporación de nuevo participante.
- [x] Restricción de movimientos sin participación activa.
- [x] Preferencias simuladas de bloqueo (individual/compartido).
- [x] Bloqueo automático por inactividad.
- [x] Revalidación básica para acciones sensibles.

### Diferido para versiones posteriores

- [ ] Biometría (huella dactilar, reconocimiento facial).
- [ ] RFID (tarjetas de proximidad).
- [ ] Inicio de sesión mediante teléfono (código QR, NFC).
- [ ] Acceso remoto.
- [ ] Múltiples estaciones reales (solo una estación inicialmente).
- [ ] Configuración avanzada por sucursal.
- [ ] Recuperación automatizada de PIN.

---

## 22. Relación con WORKSTATION.md

- **OPERATION_MODEL.md** es la fuente principal para todo lo relacionado con identidad, sesión y participación.
- **WORKSTATION.md** es la fuente principal para todo lo relacionado con estación, responsabilidad, entrega-recepción, recuperación extraordinaria y cierre.
- **Si una regla de sesión entra en conflicto con una regla de responsabilidad, ninguna debe aplicarse automáticamente.**
  La contradicción debe resolverse en documentación antes de programar cualquier comportamiento.

### Ejemplo de complementariedad

El OPERATION_MODEL.md define que un responsable puede tener la sesión bloqueada. WORKSTATION.md define que el responsable no puede finalizar su participación sin entregar la responsabilidad. Ambas reglas coexisten: el responsable puede bloquear su sesión libremente, pero no puede finalizar su participación sin el proceso definido en WORKSTATION.md.

---