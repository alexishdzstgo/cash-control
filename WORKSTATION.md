# Estación de trabajo

> **Este documento se complementa con OPERATION_MODEL.md**, que define el modelo de acceso, sesión autenticada, participación activa y responsabilidad.
>
> A partir de la versión 1.0 de OPERATION_MODEL.md, queda eliminado el concepto de **operador actual** (ver sección 3.5). El autor de cada operación es el usuario autenticado al momento de confirmarla. La pantalla exterior de acceso no pertenece al Sidebar.

---

## 1. Objetivo

La estación de trabajo es la unidad operativa principal del sistema.

Todas las operaciones, participaciones, responsabilidades, entregas-recepciones y eventos de auditoría deben pertenecer a una estación de trabajo.

Una estación no representa únicamente una computadora física. Representa una caja o punto operativo en el que pueden trabajar una o varias personas durante una jornada.

El modelo debe permitir que en el futuro un negocio tenga varias estaciones, por ejemplo:

- Caja principal
- Caja secundaria
- Ventanilla de depósitos
- Sucursal 1
- Sucursal 2

---

## 2. Principio general

La estación puede permanecer abierta durante toda la jornada, aunque las personas que trabajan en ella cambien.

Durante una jornada pueden:

- ingresar nuevos participantes;
- retirarse participantes;
- cambiar la persona responsable;
- participar empleados, el dueño y familiares autorizados;
- ocurrir entregas-recepciones normales;
- ocurrir salidas inesperadas;
- presentarse diferencias de dinero;
- registrarse desacuerdos entre quien entrega y quien recibe.

La estación no debe depender de que una sola persona permanezca durante toda la jornada.

---

## 3. Conceptos principales

### 3.1 Estación de trabajo

Representa el punto operativo donde se realizan movimientos.

Debe tener como mínimo:

- identificador;
- nombre;
- estado;
- fecha y hora de apertura;
- fecha y hora de cierre;
- responsable actual;
- participantes activos;
- jornada activa;
- estado de confianza;
- historial de eventos.

Estados iniciales:

- `closed`
- `open`
- `handover_in_progress`
- `responsibility_pending`
- `under_review`

> **Nota:** El campo `operador actual` ha sido eliminado. Ver OPERATION_MODEL.md sección 5.

---

### 3.2 Usuario

Representa a una persona autorizada para utilizar el sistema.

Puede ser:

- dueño;
- administrador;
- familiar autorizado;
- empleado;
- empleado de apoyo.

El dueño también participa en los procesos operativos.

Puede:

- abrir una estación;
- ser responsable;
- entregar responsabilidad;
- recibir responsabilidad;
- asumir responsabilidad de forma extraordinaria;
- cerrar la estación;
- realizar el corte de caja.

El dueño no debe tratarse como una entidad externa a la operación. Es un usuario con permisos adicionales.

---

### 3.3 Participación operativa

Representa el periodo durante el cual una persona se encuentra trabajando activamente en una estación.

Una participación debe registrar:

- usuario;
- estación;
- fecha y hora de ingreso;
- fecha y hora de salida;
- tipo de participación;
- estado;
- motivo de salida, cuando corresponda.

Tipos de participación:

- responsable;
- apoyo.

Puede haber varios participantes activos al mismo tiempo.

Finalizar la participación de un usuario de apoyo no implica:

- cerrar la estación;
- realizar corte de caja;
- transferir responsabilidad;
- finalizar la jornada.

---

### 3.4 Responsable actual

Es la persona que tiene la responsabilidad operativa y patrimonial de la estación en ese momento.

Solo puede existir un responsable actual por estación.

El responsable no necesariamente es la persona que está utilizando la computadora en ese momento.

El responsable puede ser:

- un empleado;
- el dueño;
- la esposa del dueño;
- un hijo autorizado;
- otro familiar o usuario con permiso suficiente.

---

### 3.5 Operador actual (eliminado)

> **Este concepto queda eliminado a partir de OPERATION_MODEL.md v1.0.**

Anteriormente se definía "operador actual" como la persona que utiliza la interfaz en un momento dado. Este concepto ha sido eliminado porque era redundante con la sesión desbloqueada.

En el nuevo modelo:

- **No existe un operador actual almacenado en la estación.**
- **No se usa `isCurrentOperator`.**
- **El autor de una operación es el usuario autenticado al momento de confirmarla.**
- **Para cambiar de persona se bloquea la sesión y se autentica al siguiente usuario.**

Ver OPERATION_MODEL.md secciones 5 y 7 para la definición completa.

---

### 3.6 Jornada operativa

Representa el periodo comprendido entre la apertura y el cierre de una estación.

Una jornada puede contener:

- varios participantes;
- varios cambios de responsabilidad;
- una o más entregas-recepciones;
- recuperaciones extraordinarias;
- operaciones;
- retiros pendientes;
- diferencias;
- aclaraciones;
- corte final.

La jornada no debe confundirse con el horario laboral de un empleado.

---

## 4. Reglas que nunca deben romperse

1. Solo puede existir un responsable actual por estación.

2. Puede haber varios participantes activos.

3. Todo responsable debe tener una participación activa, salvo durante un estado extraordinario de responsabilidad pendiente.

4. Toda operación debe quedar asociada al usuario autenticado que la registró (ver OPERATION_MODEL.md sección 5).

5. Toda operación debe guardar quién era el responsable en el momento de su creación.

6. Un usuario de apoyo puede finalizar su participación sin realizar una entrega-recepción.

7. El responsable no puede finalizar normalmente su participación sin que otra persona acepte o asuma la responsabilidad.

8. La responsabilidad nunca debe cambiar automáticamente.

9. La responsabilidad debe aceptarse o asumirse mediante un evento explícito.

10. Solo un usuario activo y autorizado puede aceptar la responsabilidad.

11. La declaración del entregante y la declaración del receptor deben ser independientes.

12. Ninguna persona puede modificar la declaración de otra.

13. Una declaración confirmada no debe editarse silenciosamente.

14. Si se requiere agregar información posterior, debe registrarse una aclaración nueva.

15. El sistema no debe decidir cuál de las partes tiene la razón durante un desacuerdo.

16. El sistema debe calcular y mostrar diferencias objetivas.

17. Una entrega con diferencias puede completarse si el receptor decide aceptar la responsabilidad.

18. Una recuperación extraordinaria debe quedar diferenciada de una entrega-recepción normal.

19. Todo cambio de responsabilidad debe generar un evento auditable.

20. El dueño debe poder entregar, recibir, asumir y cerrar una estación como cualquier otro responsable autorizado.

21. El sistema debe conservar la historia original de los hechos.

---

## 5. Apertura de estación

Cuando la estación está cerrada, no deben permitirse operaciones.

El primer usuario autorizado debe:

1. identificarse;
2. registrar o validar los saldos iniciales;
3. revisar pendientes;
4. agregar observaciones si es necesario;
5. aceptar la responsabilidad;
6. abrir la estación.

El usuario que abre la estación se convierte inicialmente en:

- participante activo;
- responsable.

La apertura debe generar un evento auditable.

---

## 6. Incorporación de participantes

Un nuevo usuario puede ingresar durante una jornada ya iniciada.

Debe:

1. identificarse mediante su PIN (ver OPERATION_MODEL.md sección 8);
2. iniciar una participación activa;
3. quedar inicialmente como usuario de apoyo.

El ingreso de un participante no debe cambiar automáticamente:

- el responsable;
- la sesión desbloqueada;
- los saldos;
- el estado de la estación.

Después de ingresar, el usuario puede desbloquear la sesión si otro usuario bloqueó previamente. No existe un "cambio de operador" separado (ver OPERATION_MODEL.md sección 5).

---

## 7. Cambio de sesión (anteriormente "Cambio de operador")

> **A partir de OPERATION_MODEL.md v1.0, no existe una acción explícita de "cambio de operador".**

El cambio de persona que utiliza la computadora ocurre mediante el siguiente flujo definido en OPERATION_MODEL.md:

1. El usuario actual bloquea su sesión (pulsa "Bloquear").
2. La pantalla exterior de acceso se muestra.
3. El siguiente usuario selecciona su perfil e introduce su PIN.
4. La sesión se desbloquea para el nuevo usuario.

Este flujo no inicia ni finaliza participaciones.

Debe mostrarse permanentemente en la interfaz interna:

- responsable actual;
- estación activa;
- usuario autenticado (sesión desbloqueada).

---

## 8. Finalización de participación

### 8.1 Usuario de apoyo

Un usuario de apoyo puede finalizar su participación.

El sistema debe registrar:

- usuario;
- fecha y hora;
- motivo opcional;
- quién confirmó la salida.

Esto no genera entrega-recepción.

---

### 8.2 Responsable

El responsable no puede finalizar normalmente su participación mientras conserve la responsabilidad.

Antes de salir debe ocurrir una de estas situaciones:

- entrega-recepción aceptada;
- recuperación extraordinaria;
- cierre definitivo de la estación.

---

## 9. Toma de responsabilidad

La responsabilidad no debe entenderse únicamente como algo que una persona entrega.

La persona receptora debe aceptar o asumir explícitamente la responsabilidad.

Existirán dos mecanismos:

1. entrega-recepción acordada;
2. recuperación extraordinaria.

---

## 10. Entrega-recepción acordada

La entrega-recepción ocurre cuando el responsable actual y otro usuario activo participan en el cambio.

### 10.1 Inicio

El responsable actual puede solicitar una entrega-recepción a un participante activo.

El posible receptor debe aceptar iniciar el proceso.

Al iniciar se crea una fotografía inmutable de referencia con:

- fecha y hora;
- responsable actual;
- receptor propuesto;
- saldo esperado de caja física;
- saldos esperados de bancos;
- operaciones pendientes;
- retiros pendientes;
- depósitos pendientes;
- cualquier otro saldo operativo relevante.

Durante la entrega-recepción, la estación debe pausar temporalmente nuevas operaciones.

Si necesitan seguir atendiendo, deben cancelar el proceso e iniciarlo nuevamente después.

---

### 10.2 Declaración del entregante

El entregante debe registrar su propia declaración.

Puede incluir:

- cantidad que declara entregar;
- estado de bancos;
- pendientes;
- incidencias;
- diferencias conocidas;
- comentarios;
- acuerdos previos.

La declaración debe confirmarse mediante PIN o mecanismo equivalente.

Después de confirmarse no debe modificarse.

---

### 10.3 Verificación del receptor

El receptor debe verificar independientemente:

- efectivo físico;
- saldos bancarios;
- pendientes;
- documentos o comprobantes necesarios;
- operaciones incompletas;
- cualquier otro elemento operativo.

Debe registrar:

- cantidades contadas;
- saldos verificados;
- diferencias observadas;
- su propia declaración;
- notas adicionales.

La declaración debe confirmarse mediante PIN o mecanismo equivalente.

---

### 10.4 Resultado del sistema

El sistema debe calcular las diferencias automáticamente.

Ejemplo:

- saldo esperado: $8,520;
- efectivo contado por el receptor: $8,470;
- diferencia: -$50.

La diferencia calculada es un dato objetivo del sistema.

Las declaraciones de las personas son testimonios independientes.

---

### 10.5 Acuerdo y desacuerdo

Aceptar la responsabilidad no significa que ambas personas estén de acuerdo sobre la causa de una diferencia.

El entregante puede declarar:

> Entrego la caja conforme y no detecté diferencias.

El receptor puede declarar:

> Durante el conteo detecté un faltante de $50.

Ambas declaraciones deben conservarse.

El sistema no debe obligar a ninguna de las partes a cambiar su versión.

---

### 10.6 Estados de entrega-recepción

La entrega-recepción puede finalizar como:

#### Aceptada

- Los saldos coinciden.
- El receptor acepta la responsabilidad.

#### Aceptada con diferencias

- Existen diferencias.
- El receptor acepta la responsabilidad con sus observaciones.
- La diferencia queda pendiente de revisión.

#### En disputa

- Existen desacuerdos.
- El receptor no acepta la responsabilidad.
- El responsable actual conserva formalmente la responsabilidad mientras permanezca disponible.
- La estación debe quedar restringida hasta resolver o aplicar un procedimiento extraordinario.

#### Cancelada

- El proceso fue cancelado antes de completarse.
- No cambia la responsabilidad.
- Si hubo confirmaciones parciales, deben conservarse en auditoría.

---

## 11. Notas, declaraciones y acuerdos

No debe existir una única nota compartida editable por ambas personas.

Cada parte debe tener su propia declaración:

- declaración del entregante;
- declaración del receptor.

Además, puede existir una sección de acuerdos conjuntos.

Un acuerdo conjunto solo debe considerarse confirmado cuando ambas partes lo acepten mediante PIN.

Ejemplo:

> Ambas partes acuerdan que la diferencia de $50 será revisada durante el corte final.

Debe registrarse:

- quién propuso el acuerdo;
- texto del acuerdo;
- aceptación del entregante;
- aceptación del receptor;
- fecha y hora.

Si una de las personas no lo acepta, el texto puede conservarse como propuesta, pero no como acuerdo mutuo.

---

## 12. Recuperación extraordinaria

La recuperación extraordinaria ocurre cuando el responsable actual:

- se retira por una emergencia;
- abandona la estación sin completar la entrega;
- no puede participar en el proceso;
- queda incomunicado;
- está incapacitado para continuar;
- no se encuentra disponible.

La estación debe entrar en estado:

`responsibility_pending`

En este estado:

- no se debe cambiar automáticamente al responsable;
- las operaciones deben pausarse o limitarse;
- se debe mostrar una alerta visible;
- debe solicitarse que una persona autorizada asuma la responsabilidad.

---

### 12.1 Persona que puede asumir

La responsabilidad puede ser asumida por un usuario autorizado según los permisos del negocio.

Ejemplos:

- dueño;
- administradora;
- esposa del dueño;
- hijo autorizado;
- empleado con permiso de responsabilidad;
- persona designada para emergencias.

No debe depender exclusivamente de que el dueño se encuentre físicamente presente.

Los permisos deben ser configurables.

---

### 12.2 Procedimiento de recuperación

La persona que asume debe:

1. identificarse;
2. indicar el motivo;
3. verificar el efectivo;
4. verificar los bancos;
5. revisar los pendientes;
6. registrar diferencias;
7. escribir una declaración obligatoria;
8. confirmar mediante PIN;
9. aceptar explícitamente la responsabilidad.

Debe registrarse que no existió una entrega formal por parte del responsable anterior.

---

### 12.3 Estado posterior

Después de una recuperación extraordinaria:

- el nuevo usuario se convierte en responsable;
- la estación puede continuar operando;
- el estado de confianza debe cambiar a `requires_review`;
- el evento queda pendiente de revisión administrativa;
- el responsable anterior no debe poder modificar retroactivamente el evento.

El responsable anterior podrá agregar posteriormente una aclaración, pero no eliminar ni alterar la declaración de recuperación.

---

## 13. Cierre de estación

El cierre se realiza cuando termina la jornada operativa.

Puede hacerlo:

- el dueño;
- el responsable actual;
- otro usuario autorizado.

El dueño puede cerrar directamente la estación cuando trabaja solo.

El cierre debe incluir:

- saldo esperado;
- efectivo contado;
- saldos bancarios verificados;
- pendientes;
- diferencias;
- declaraciones;
- retiros realizados por el dueño;
- observaciones;
- confirmación de quien realiza el cierre.

Si trabaja una sola persona, no se requiere entrega-recepción bilateral.

Debe generarse una declaración individual de cierre.

La estación cambia a estado `closed` después de confirmar el corte.

---

## 14. Estado de confianza

La estación puede mostrar un indicador operativo.

### Confiable

- no existen diferencias pendientes;
- la última entrega fue aceptada sin diferencias;
- no existen recuperaciones sin revisar.

### Con observaciones

- existen diferencias aceptadas;
- hay acuerdos o aclaraciones pendientes;
- la operación puede continuar.

### Requiere revisión

- ocurrió una recuperación extraordinaria;
- existe una disputa;
- hay diferencias importantes;
- faltan confirmaciones;
- existe un evento crítico sin resolver.

El estado de confianza informa y alerta, pero no debe ocultar los detalles.

---

## 15. Eventos auditables

Como mínimo deben registrarse:

- estación abierta;
- estación cerrada;
- participante incorporado;
- participación finalizada;
- sesión bloqueada;
- sesión desbloqueada;
- participación iniciada por intención;
- cambio de modo individual a compartido;
- revalidación de identidad;
- entrega-recepción iniciada;
- entrega-recepción cancelada;
- declaración del entregante confirmada;
- declaración del receptor confirmada;
- acuerdo propuesto;
- acuerdo aceptado;
- acuerdo rechazado;
- responsabilidad aceptada;
- responsabilidad asumida de forma extraordinaria;
- diferencia detectada;
- aclaración agregada;
- disputa creada;
- disputa revisada;
- estado de confianza modificado.

Cada evento debe registrar:

- estación;
- jornada;
- usuario que realizó la acción;
- usuario afectado;
- fecha y hora;
- tipo de evento;
- estado anterior;
- estado posterior;
- motivo;
- notas;
- información relevante para auditoría.

---

## 16. Asociación de operaciones

Toda operación debe guardar como mínimo:

- estación;
- jornada;
- usuario autenticado que registró la operación;
- responsable vigente al crearla;
- fecha y hora;
- tipo de operación;
- estado.

Ejemplo:

- responsable: María;
- registrado por: Juan (usuario autenticado);
- estación: Caja principal.

---

## 17. Casos de ejemplo

### Caso A: dueño trabajando solo

1. El dueño abre la estación.
2. Se convierte en responsable.
3. Registra movimientos.
4. Realiza el corte.
5. Cierra la estación.

No existe entrega-recepción bilateral.

---

### Caso B: entra un empleado de apoyo

1. María abre como responsable.
2. Juan inicia participación como apoyo.
3. Juan desbloquea la sesión (María bloqueó).
4. María continúa como responsable.
5. Juan finaliza su participación.
6. La estación continúa abierta.

---

### Caso C: entrega sin diferencias

1. María solicita entregar a Juan.
2. Se congela la referencia de saldos.
3. María confirma su declaración.
4. Juan verifica.
5. Los saldos coinciden.
6. Juan acepta la responsabilidad.
7. María finaliza su participación.

---

### Caso D: entrega con diferencia aceptada

1. El sistema espera $8,520.
2. El receptor cuenta $8,470.
3. El sistema calcula -$50.
4. El entregante declara no haber detectado diferencias.
5. El receptor declara el faltante.
6. Ambos pueden registrar un acuerdo conjunto.
7. El receptor acepta la responsabilidad.
8. La entrega queda aceptada con diferencias.
9. El estado queda con observaciones.

---

### Caso E: receptor no acepta

1. Se detecta una diferencia.
2. El receptor no acepta la responsabilidad.
3. La entrega queda en disputa.
4. No se cambia al responsable.
5. Se requiere revisión o procedimiento extraordinario.

---

### Caso F: salida de emergencia

1. El responsable se retira sin entregar.
2. La estación entra en responsabilidad pendiente.
3. Un usuario autorizado verifica los saldos.
4. Registra su declaración.
5. Acepta asumir la responsabilidad.
6. Se genera una recuperación extraordinaria.
7. La estación continúa con estado de revisión.

---

### Caso G: dueño recibe turno

1. Un empleado solicita entregar.
2. El dueño participa como receptor.
3. Verifica los saldos.
4. Registra su declaración.
5. Acepta la responsabilidad.
6. Continúa operando o realiza el cierre.

---

## 18. Alcance inicial

La primera versión del módulo debe contemplar:

- una estación;
- múltiples participantes;
- un responsable;
- finalización de participantes;
- entrega-recepción;
- declaraciones independientes;
- diferencias automáticas;
- acuerdos conjuntos;
- recuperación extraordinaria;
- apertura;
- cierre;
- auditoría.

No es necesario implementar inicialmente:

- múltiples sucursales;
- firma biométrica;
- reconocimiento facial;
- aprobación remota;
- resolución automática de disputas;
- notificaciones externas;
- documentos legales en PDF;
- integración contable avanzada.

Estos elementos pueden considerarse en futuras versiones.