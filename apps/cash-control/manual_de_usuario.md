# Manual de Usuario - Cash Control

Bienvenido al sistema **Cash Control**, una plataforma diseñada para gestionar de forma estricta, auditable y segura el control del flujo de efectivo, saldos bancarios y operaciones diarias de tu negocio. A continuación se detallan los módulos principales y su uso correcto.

---

## 1. Acceso al Sistema (Workstation)
El sistema opera bajo un entorno controlado llamado **Estación de Trabajo**. Para evitar accesos anónimos, toda interacción requiere que inicies sesión.

- **Estación Cerrada:** Es la vista principal al arrancar el sistema. Verás una lista de los usuarios activos.
- **Login con PIN:** Haz clic en tu nombre e ingresa tu PIN personal de seguridad de 4 a 6 dígitos.
- **Sesión Activa:** Una vez que ingreses, te convertirás en el "Operador" actual. Todos los movimientos e ingresos que marques quedarán registrados con tu nombre de usuario para auditoría.

---

## 2. Gestión de Turnos (Apertura y Cierre)
Las finanzas del día se controlan dividiendo el tiempo en "Turnos". Solo puede haber un turno abierto por estación.

### 2.1 Apertura de Turno
1. Ve al módulo **Turno Actual**.
2. Presiona **Abrir turno**.
3. El sistema te pedirá que declares con cuánto dinero estás recibiendo la caja ("Efectivo inicial") y que valides los saldos con los que arrancan los bancos. 
4. Aquel que abra el turno se convierte en el **Responsable del turno**. Solo el responsable tiene los permisos para cerrar la caja al finalizar el día.

### 2.2 Corte de Caja (Cierre de Turno)
Al terminar la jornada de trabajo, el Responsable debe formalizar la validación del dinero.
1. Dirígete al apartado **Corte de caja**.
2. **Revisión Histórica:** Lee atentamente la lista de movimientos para identificar cuánto debería haber en caja basado en el registro del día.
3. **Captura:** Ingresa físicamente moneda por moneda y billete por billete lo que contaste. Introduce esa cifra en **"Caja disponible"**.
4. Valida y escribe los saldos finales consultando las aplicaciones bancarias reales (Azteca, Mercado, etc).
5. Haz clic en **Cerrar corte**. El sistema cotejará tus números. Si hay diferencias (faltantes o sobrantes), deberás dejar una **Observación obligatoria** para explicar el motivo. Al cerrar, la base de datos se actualiza definitivamente y los folios inician limpios.

---

## 3. Módulos de Operación Diaria
Mientras el turno está abierto, los operadores pueden registrar movimientos del negocio:

- **Caja y Bancos:** Pantalla de supervisión de saldos actuales en tiempo real. Divide entre caja física, apartados, y distintos bancos.
- **Depósitos y Retiros:** Registra todo el dinero que entra o sale del negocio a petición de los clientes. Selecciona de qué fondo (banco o efectivo) salió y el monto total para equilibrar las cajas.
- **Retiros Pendientes:** Movimientos reservados que todavía están "aislados" hasta ser liquidados porque falta confirmación.
- **Comisiones:** Verifica los cargos y utilidades dejadas durante el turno de las transacciones procesadas con clientes.
- **Alertas:** Verás avisos preventivos. Por ejemplo, si alguna caja ha caído por debajo de un umbral de seguridad, aparecerá aquí.

---

## 4. Módulo de Administración (Solo Dueños)
Los usuarios con el Rol `owner` tendrán acceso a opciones exclusivas de jefatura:

- **Usuarios:** Aquí podrás dar de alta a nuevos empleados, suspender usuarios inactivos o editar sus perfiles.
- **Fondos del negocio:** Define qué cajas y cuentas bancarias utiliza tu empresa. Puedes establecer **Umbrales críticos y bajos** (Alertas si se rebasa un límite).
- **Asignar Responsabilidad:** Permite rotar turnos si un responsable necesita retirarse antes de que se haga el Corte de Caja.

---

## Consejos de Seguridad 🔒
- Nunca compartas tu PIN con otros operadores.
- Cierra explícitamente tu sesión de la Estación de Trabajo presionando "Bloquear Estación" si te vas a retirar del escritorio para evitar que otro empleado realice un movimiento usando tu perfil.
- Sé detallado en las anotaciones: Trata de justificar explícitamente en el campo *Observaciones* cualquier movimiento anómalo, un centavo documentado vale el doble frente a una posterior auditoría.
