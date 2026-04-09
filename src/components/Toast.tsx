"use client";

import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg =
    type === "success"
      ? "var(--green)"
      : type === "error"
        ? "var(--red)"
        : "var(--yellow)";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: bg,
        color: "#000",
        padding: "12px 20px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        zIndex: 1000,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        animation: "slideIn 0.3s ease",
      }}
    >
      {message}
    </div>
  );
}
