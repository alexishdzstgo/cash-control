/**
 * Estilos globales reutilizables para tarjetas y botones de acción rápida.
 * Proporciona affordance interactiva con:
 * 1. Fondo azul suave en hover (`hover:bg-primary-blue-soft/70` y `hover:border-blue-200`).
 * 2. Rectángulo/barra indicadora lateral azul en el borde izquierdo (`rounded-r-full`).
 */

export const ACTION_BUTTON_CARD_CLASSES = {
    /** Contenedor interactivo (hover con fondo azul sutil, sombra e indicador) */
    interactive:
        "group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-200 hover:border-blue-200 hover:bg-blue-100/60 hover:shadow-md",

    /** Contenedor en estado deshabilitado */
    disabled:
        "flex cursor-not-allowed items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5 opacity-60",

    /** Rectángulo indicador azul vertical a la izquierda */
    leftIndicator:
        "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary-blue opacity-0 transition-opacity duration-200 group-hover:opacity-100",
} as const;
