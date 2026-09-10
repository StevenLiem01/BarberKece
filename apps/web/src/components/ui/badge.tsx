import React from "react";

export type BadgeVariant =
  "default" | "success" | "warning" | "error" | "info" | "neutral" | "lime";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: string;
  children?: React.ReactNode;
}

export function getAppointmentStatusMeta(status: string): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case "CONFIRMED":
      return { label: "Terkonfirmasi", variant: "success" };
    case "CHECKED_IN":
      return { label: "Check-In", variant: "info" };
    case "IN_SERVICE":
      return { label: "Sedang Dilayani", variant: "lime" };
    case "COMPLETED":
      return { label: "Selesai", variant: "neutral" };
    case "CANCELLED_BY_CUSTOMER":
      return { label: "Dibatalkan (Pelanggan)", variant: "error" };
    case "CANCELLED_BY_BARBERSHOP":
      return { label: "Dibatalkan (Barbershop)", variant: "error" };
    case "NO_SHOW":
      return { label: "Tidak Hadir", variant: "warning" };
    default:
      return { label: status, variant: "default" };
  }
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[#FAF8F3] text-[#11110F] border-[#D8D4CA]",
  success: "bg-[#2F7D4A]/10 text-[#2F7D4A] border-[#2F7D4A]/30",
  warning: "bg-[#A66A16]/10 text-[#A66A16] border-[#A66A16]/30",
  error: "bg-[#B63D37]/10 text-[#B63D37] border-[#B63D37]/30",
  info: "bg-[#3E667D]/10 text-[#3E667D] border-[#3E667D]/30",
  neutral: "bg-[#22231F]/10 text-[#22231F] border-[#22231F]/20",
  lime: "bg-[#C9F23B]/25 text-[#11110F] border-[#C9F23B]/80",
};

export function Badge({
  variant,
  status,
  children,
  className = "",
  ...props
}: BadgeProps) {
  let resolvedLabel = children;
  let resolvedVariant: BadgeVariant = variant ?? "default";

  if (status) {
    const meta = getAppointmentStatusMeta(status);
    if (!variant) {
      resolvedVariant = meta.variant;
    }
    if (!children) {
      resolvedLabel = meta.label;
    }
  }

  const baseStyle =
    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors";
  const colorStyle = variantStyles[resolvedVariant];

  return (
    <span
      role="status"
      className={`${baseStyle} ${colorStyle} ${className}`}
      {...props}
    >
      {resolvedLabel}
    </span>
  );
}
