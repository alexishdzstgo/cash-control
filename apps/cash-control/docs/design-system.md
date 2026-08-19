# Cash Control Surface System v1

Este sistema captura la direccion visual aprobada en el modal "Nuevo movimiento de fondos". No implica que todas las pantallas ya esten migradas; sirve como base para migraciones futuras.

## Principio

Cash Control usa una superficie fria, contenido blanco, estructura oscura y azul para acciones.

- Superficie de app/modal: `--surface-app` = `#EEF4FB`
- Estructura oscura: `--surface-dark` = `#0F172A`
- Card/input: `--surface-card` = `#FFFFFF`
- Superficie neutral: `--surface-neutral` = `#F8FAFC`
- Borde: `--surface-border` = `#E2E8F0`
- Borde fuerte: `--surface-border-strong` = `#CBD5E1`

## Texto

- Texto principal: `--surface-text-primary` = `#0F172A`
- Texto secundario: `--surface-text-secondary` = `#64748B`
- Etiqueta financiera: `--surface-text-label` = `#475569`
- Texto sutil / placeholder: `--surface-text-subtle` = `#94A3B8`
- Labels principales de formulario: usar `.cc-form-label`.

## Inputs

Usar `.field-input`.

- Fondo: `--card` / `#FFFFFF`
- Texto: `--foreground` / `#0F172A`
- Borde: `--border` / `#E2E8F0`
- Placeholder: `--surface-text-subtle`
- Focus: azul del sistema

## Botones

Usar los botones existentes:

- Primario: `.btn-primary`
  - Fondo: `--surface-primary-action` = `#2563EB`
  - Hover: `--surface-primary-action-hover` = `#1D4ED8`
  - Texto: blanco
- Secundario: `.btn-secondary`
  - Fondo: blanco
  - Texto: `--surface-text-primary`
  - Borde: `--border`
  - Hover: `--surface-neutral`

## Modal Pattern

Para modales nuevos que adopten este sistema:

- Contenedor: `.cc-modal-surface`
- Header: `.cc-modal-header`
- Titulo: `.cc-modal-title`
- Descripcion: `.cc-modal-description`
- Footer: integrado visualmente con el cuerpo
- Cards internas: blancas, solo para grupos conceptuales reales

## Selector Binario

Usar el patron aprobado para opciones como `Ingreso | Retiro`:

- Seleccionado: `.cc-segmented-option-selected`
- No seleccionado: `.cc-segmented-option-unselected`
- El contenedor solo debe resolver layout; no debe agregar marco exterior.

## Informacion Financiera

Para bloques como `Disponible actual` y `Despues del movimiento`:

- Etiqueta: `.cc-financial-info-label`
- Valor: `.cc-financial-info-value`
- Card: blanca, borde suave, sin sombra pesada

## Colores Semanticos

No reemplazar colores semanticos con el sistema estructural.

- Exito: verde
- Error/faltante: rojo
- Pendiente/apartado: ambar
- Depositos, retiros, comisiones y estados mantienen sus colores de dominio.

El azul claro de superficie no sustituye colores de estado.
