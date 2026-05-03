"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

const variants: Record<Variant, string> = {
  primary: "bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-600",
  secondary: "bg-white border border-stone-200 text-stone-800 hover:bg-stone-50 focus:ring-stone-300",
  danger: "bg-white border border-red-200 text-red-700 hover:bg-red-50 focus:ring-red-300",
  ghost: "text-stone-700 hover:bg-stone-100 focus:ring-stone-300",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, disabled, fullWidth, className = "", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
});

export default Button;
