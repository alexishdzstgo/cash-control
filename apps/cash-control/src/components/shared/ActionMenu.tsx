"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ActionMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
};

type MenuPosition = {
  top: number;
  right: number;
};

const MENU_WIDTH = 208;
const MENU_ESTIMATED_HEIGHT = 190;
const SCREEN_MARGIN = 12;

export function ActionMenu({ items }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({
    top: 0,
    right: SCREEN_MARGIN,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;

      if (!button) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const availableSpaceBelow = window.innerHeight - buttonRect.bottom;

      const shouldOpenAbove =
        availableSpaceBelow < MENU_ESTIMATED_HEIGHT &&
        buttonRect.top > MENU_ESTIMATED_HEIGHT;

      const top = shouldOpenAbove
        ? buttonRect.top - MENU_ESTIMATED_HEIGHT - 8
        : buttonRect.bottom + 8;

      const right = Math.max(
        SCREEN_MARGIN,
        window.innerWidth - buttonRect.right,
      );

      setPosition({
        top: Math.max(SCREEN_MARGIN, top),
        right,
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      const clickedButton = buttonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (!clickedButton && !clickedMenu) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    updatePosition();

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const menu =
    isMounted && isOpen
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[70] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{
              top: position.top,
              right: position.right,
              maxWidth: `calc(100vw - ${SCREEN_MARGIN * 2}px)`,
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }

                  item.onClick();
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title="Más acciones"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menu}
    </>
  );
}