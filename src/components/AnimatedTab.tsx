"use client";

import { useState, useEffect, useRef, ReactNode } from "react";

interface AnimatedTabProps {
  children: ReactNode;
  isActive: boolean;
  direction?: "left" | "right" | "up" | "down";
  duration?: number;
  className?: string;
}

/**
 * AnimatedTab - Wrapper component for smooth tab transitions
 * Provides fade + slide animations when switching between tabs
 */
export default function AnimatedTab({
  children,
  isActive,
  direction = "right",
  duration = 300,
  className = "",
}: AnimatedTabProps) {
  const [shouldRender, setShouldRender] = useState(isActive);
  const [animationState, setAnimationState] = useState<"entering" | "visible" | "exiting">(
    "visible"
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isActive) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready for animation
      requestAnimationFrame(() => {
        setAnimationState("entering");
        timeoutRef.current = setTimeout(() => {
          setAnimationState("visible");
        }, duration);
      });
    } else {
      setAnimationState("exiting");
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false);
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, duration]);

  if (!shouldRender) return null;

  // Generate animation classes based on direction and state
  const getAnimationClasses = () => {
    const baseClasses = "transition-all ease-out";
    const durationClass = `duration-${duration}`;

    if (animationState === "entering") {
      return `${baseClasses} animate-tab-fade-in`;
    }

    if (animationState === "exiting") {
      return `${baseClasses} animate-tab-fade-out`;
    }

    return baseClasses;
  };

  return <div className={`${getAnimationClasses()} ${className}`}>{children}</div>;
}

/**
 * TabContainer - Container for managing multiple tabs with animations
 */
interface TabContainerProps {
  activeTab: string;
  children: ReactNode;
  className?: string;
}

export function TabContainer({ activeTab, children, className = "" }: TabContainerProps) {
  return <div className={`relative ${className}`}>{children}</div>;
}

/**
 * TabContent - Individual tab content wrapper
 */
interface TabContentProps {
  tabId: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
}

export function TabContent({ tabId, activeTab, children, className = "" }: TabContentProps) {
  const isActive = tabId === activeTab;

  return (
    <AnimatedTab isActive={isActive} className={className}>
      {children}
    </AnimatedTab>
  );
}

/**
 * AnimatedButton - Button with hover glow and click ripple effects
 */
interface AnimatedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "gold" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  glowOnHover?: boolean;
}

export function AnimatedButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  className = "",
  glowOnHover = true,
}: AnimatedButtonProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Create ripple effect
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newRipple = { x, y, id: Date.now() };
      setRipples((prev) => [...prev, newRipple]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);
    }

    onClick?.();
  };

  const variantClasses = {
    primary: "bg-xianxia-accent hover:bg-xianxia-accent/80 text-white",
    secondary: "bg-gray-600 hover:bg-gray-500 text-white",
    gold: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black",
    danger: "bg-red-600 hover:bg-red-500 text-white",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const glowClass =
    glowOnHover && !disabled ? "hover:shadow-[0_0_15px_currentColor] hover:brightness-110" : "";

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative overflow-hidden
        rounded-lg font-medium
        transition-all duration-200 ease-out
        active:animate-button-press
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${glowClass}
        ${className}
      `}
    >
      {children}
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 pointer-events-none animate-button-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 10,
            height: 10,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </button>
  );
}

/**
 * AnimatedList - List with staggered item animations
 */
interface AnimatedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  staggerDelay?: number;
  className?: string;
  itemClassName?: string;
}

export function AnimatedList<T>({
  items,
  renderItem,
  keyExtractor,
  staggerDelay = 50,
  className = "",
  itemClassName = "",
}: AnimatedListProps<T>) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div
          key={keyExtractor(item, index)}
          className={`animate-list-item-in ${itemClassName}`}
          style={{ animationDelay: `${index * staggerDelay}ms` }}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

/**
 * AnimatedModal - Modal with enter/exit animations
 */
interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function AnimatedModal({
  isOpen,
  onClose,
  children,
  title,
  className = "",
}: AnimatedModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animationState, setAnimationState] = useState<"entering" | "visible" | "exiting">(
    "visible"
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setAnimationState("entering");
        setTimeout(() => setAnimationState("visible"), 300);
      });
    } else {
      setAnimationState("exiting");
      setTimeout(() => setShouldRender(false), 200);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 ${
          animationState === "entering" ? "animate-modal-backdrop" : ""
        } ${animationState === "exiting" ? "animate-fade-out" : ""}`}
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        className={`
          relative z-10 bg-xianxia-dark border border-xianxia-accent/30 rounded-xl
          max-w-lg w-full mx-4 p-6
          ${animationState === "entering" ? "animate-modal-enter" : ""}
          ${animationState === "exiting" ? "animate-modal-exit" : ""}
          ${className}
        `}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-xianxia-gold">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
