"use client";

import { useEffect, useRef, useCallback } from "react";

interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close (Escape key, backdrop click) */
  onClose?: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Additional classes for the modal container */
  className?: string;
  /** Whether clicking the backdrop closes the modal (default: true if onClose provided) */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the modal (default: true if onClose provided) */
  closeOnEscape?: boolean;
  /** Z-index level: 'default' = z-40, 'high' = z-50 */
  zLevel?: "default" | "high";
  /** Backdrop opacity class (default: bg-black/80) */
  backdropClass?: string;
}

export default function Modal({
  isOpen,
  onClose,
  children,
  className = "",
  closeOnBackdrop = true,
  closeOnEscape = true,
  zLevel = "high",
  backdropClass = "bg-black/80",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Focus management and keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Add escape listener
    document.addEventListener("keydown", handleKeyDown);

    // Focus first focusable element in modal
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }
    }, 50);

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;

      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const zClass = zLevel === "high" ? "z-50" : "z-40";

  return (
    <div
      className={`fixed inset-0 ${backdropClass} ${zClass} flex items-center justify-center p-4 animate-modal-backdrop`}
      onClick={(e) => {
        if (closeOnBackdrop && onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className={`animate-modal-enter ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Reusable close button for modals */
export function ModalCloseButton({
  onClose,
  className = "",
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClose}
      className={`text-gray-400 hover:text-white transition-colors text-2xl leading-none ${className}`}
      aria-label="Close"
    >
      ×
    </button>
  );
}
