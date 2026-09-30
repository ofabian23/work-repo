"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional supporting text announced with the title. */
  description?: string;
  children?: ReactNode;
  /** Actions rendered at the bottom (in reach), e.g. PrimaryAction/SecondaryAction. */
  footer?: ReactNode;
  /** Hide the × button for dialogs that must be answered through their actions. */
  hideCloseButton?: boolean;
  /** Tapping the dimmed backdrop closes the dialog (default true). */
  closeOnBackdrop?: boolean;
  testId?: string;
};

/**
 * Native <dialog> (showModal) wrapper: the browser provides focus containment, Esc handling, an inert
 * background and focus return. Motion is limited to a short fade/slide, disabled with reduced motion.
 * Mark the preferred initial focus with `data-autofocus` (otherwise the browser focuses the first control).
 */
function Dialog({
  variant,
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideCloseButton,
  closeOnBackdrop = true,
  testId,
}: DialogProps & { variant: "modal" | "sheet" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { t } = useLanguage();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs before showModal(); honor an explicit initial-focus target instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      data-variant={variant}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: keep React state as the source of truth.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "bg-surface text-ink backdrop:motion-safe:animate-fade-in m-auto max-h-[90dvh] w-full overflow-hidden p-0",
        variant === "sheet"
          ? "rounded-t-sheet shadow-sheet motion-safe:open:animate-sheet-in mb-0 max-w-[1080px]"
          : "rounded-sheet shadow-raised motion-safe:open:animate-fade-in max-w-2xl",
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="px-gutter flex items-start justify-between gap-4 pt-8 pb-4">
            <div className="flex flex-col gap-2">
              <h2 id={titleId} className="text-title font-bold text-balance">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-body text-ink-muted text-pretty">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("ui.close")}
                className="focus-ring bg-surface-muted text-ink active:bg-line size-touch flex shrink-0 items-center justify-center rounded-full"
              >
                <CloseIcon />
              </button>
            )}
          </header>
          {children && (
            // Long content scrolls; the region is focusable so keyboard users can scroll it too (WCAG 2.1.1).
            <div
              role="region"
              aria-labelledby={titleId}
              tabIndex={0}
              className="px-gutter focus-ring overflow-y-auto pb-6"
            >
              {children}
            </div>
          )}
          {footer && (
            <div className="border-line px-gutter flex flex-col-reverse gap-4 border-t py-5 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

/** Centered dialog for short confirmations and warnings. */
export function Modal(props: DialogProps) {
  return <Dialog variant="modal" {...props} />;
}

/** Bottom sheet for panels (hotspot details, solution panels): content stays in reach at the bottom. */
export function Sheet(props: DialogProps) {
  return <Dialog variant="sheet" {...props} />;
}
