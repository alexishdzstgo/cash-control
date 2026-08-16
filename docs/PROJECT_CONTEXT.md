# PROJECT_CONTEXT.md

## Proyecto

**Xolobit – Control de efectivo en transferencias y depósitos**

Sistema web para una papelería que ofrece servicios de depósitos, transferencias y retiros. El objetivo principal es evitar errores en el corte de caja, mejorar el control del efectivo, registrar operaciones con trazabilidad y permitir al dueño revisar movimientos, saldos y cambios realizados por empleados.

## Problema principal

Actualmente el negocio registra operaciones de forma manual, lo que provoca:

* Cortes de caja que no cuadran.
* Olvidos al registrar depósitos, transferencias o retiros.
* Falta de historial confiable.
* Dificultad para saber quién registró o modificó una operación.
* Riesgo al manejar montos altos.
* Falta de control en cambios de turno.

## Objetivo del MVP

Crear una aplicación web interna que permita:

* Registrar operaciones.
* Validar folios duplicados.
* Calcular comisiones automáticamente.
* Consultar historial de operaciones.
* Controlar estados: pendiente y entregado.
* Registrar usuario que captura cada operación.
* Tener trazabilidad de cambios.
* Preparar posteriormente cortes por turno y cortes diarios.

## Usuarios principales

### Dueño

Puede revisar todas las operaciones, saldos, historial, cortes y modificaciones.

### Empleado

Puede registrar operaciones, consultar movimientos recientes y marcar entregas según permisos.

## Operaciones principales

### Depósito

El cliente deposita dinero a una cuenta del negocio y después retira efectivo en tienda.

Datos importantes:

* Monto.
* Banco origen.
* Banco destino.
* Folio bancario.
* Nombre de quien envía.
* Nombre de quien recibe.
* Comisión.
* Estado.
* Usuario que registró.
* Fecha y hora.

### Transferencia

El cliente entrega efectivo y el negocio realiza una transferencia a una cuenta destino.

Datos importantes:

* Monto.
* Banco origen o cuenta de salida.
* Banco destino.
* Folio bancario.
* Nombre de quien envía.
* Nombre de quien recibe.
* Comisión.
* Estado.
* Usuario que registró.
* Fecha y hora.

### Retiro

Operación relacionada con entrega de efectivo al cliente o retiro interno del dueño, según se defina en el flujo.

## Reglas importantes

* El folio bancario es obligatorio.
* No se deben permitir folios duplicados.
* Las comisiones se calculan por rangos configurables.
* Toda operación debe guardar fecha y hora.
* Toda operación debe guardar el usuario que la registró.
* Las operaciones editadas deben quedar marcadas.
* El historial de cambios debe conservarse.
* El empleado no debe ver ganancias completas del negocio.
* El dueño sí debe poder ver reportes, totales y auditoría.

## Estados de operación

* **Pendiente:** operación registrada pero aún no completada o entregada.
* **Entregado:** operación completada.
* **Editado:** marca visual cuando una operación fue modificada.

## Diseño esperado

La interfaz debe ser:

* Moderna.
* Clara.
* Rápida.
* Sin recargas innecesarias.
* Responsive para computadora, tablet y móvil.
* Con colores suaves.
* Con alertas tenues.
* Con animaciones ligeras.
* Sin saturar visualmente la pantalla.

## Stack actual

Frontend:

* React
* Vite
* TypeScript
* Tailwind CSS

Backend:

* Node.js
* Express
* MongoDB
* Mongoose

Autenticación:

* JWT
* Login de administrador/empleado

Herramientas:

* Git
* GitHub
* pnpm
* VS Code

## Estado actual del proyecto

Ya se trabajó en la base visual y funcional inicial. El siguiente avance importante es el **Sprint 3: Historial de operaciones**.

## Sprint 3: Historial de operaciones

Objetivo:

Crear una pantalla donde se puedan consultar las operaciones registradas.

Funcionalidades esperadas:

* Mostrar lista de operaciones.
* Buscar por folio.
* Buscar por nombre.
* Filtrar por fecha.
* Filtrar por tipo de operación.
* Filtrar por estado.
* Mostrar monto, comisión, banco, folio, usuario y fecha.
* Identificar operaciones pendientes.
* Identificar operaciones editadas.
* Preparar estructura para ver detalle de operación.

## Prioridad actual

Construir primero una versión funcional del historial, aunque sea sencilla. Después se puede mejorar el diseño, filtros avanzados, paginación y detalle completo.
