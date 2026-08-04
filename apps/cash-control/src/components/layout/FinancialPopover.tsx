"use client";

import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";

export type PopoverAlign = "start" | "center" | "end";
export type PopoverSide = "bottom" | "top" | "right" | "left";

interface FinancialPopoverProps {
  button: ReactNode;
  buttonClassName?: string;
  children: ReactNode;
  title: string;
  align?: PopoverAlign;
  side?: PopoverSide;
  sideOffset?: number;
  mobileWidthClass?: string;
}

/**
 * Popover compartido basado en Base UI.
 * `Popover.Portal` renderiza hacia document.body, fuera de ancestros con overflow-hidden.
 * Base UI gestiona posicionamiento, detección de bordes, z-index, Escape, click fuera y foco.
 */
export function FinancialPopover({
  button,
  buttonClassName,
  children,
  title,
  align = "start",
  side = "bottom",
  sideOffset = 8,
  mobileWidthClass = "w-72",
}: FinancialPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-haspopup="dialog"
            className={buttonClassName}
          />
        }
      >
        {button}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} align={align} sideOffset={sideOffset}>
          <Popover.Popup
            role="dialog"
            aria-label={title}
            className={`max-h-[80vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl ${mobileWidthClass}`}
          >
            <Popover.Arrow className="fill-white stroke-slate-200" />
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </p>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}