"use client";

import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

const baseInputClass =
  "w-full px-3 py-2 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 transition-colors disabled:bg-stone-50 disabled:text-stone-500";

function withError(error?: string) {
  return error
    ? "border-red-300 focus:ring-red-300 focus:border-red-400"
    : "border-stone-200 focus:ring-teal-600 focus:border-teal-600";
}

type FieldWrapProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, error, required, children, className = "" }: FieldWrapProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm text-stone-700 mb-1 font-medium">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-red-700 mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className = "", id, ...rest },
  ref
) {
  const fieldId = id || rest.name;
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        className={`${baseInputClass} ${withError(error)} ${className}`}
        {...rest}
      />
    </Field>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, options, placeholder, children, className = "", ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        required={required}
        className={`${baseInputClass} ${withError(error)} ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : children}
      </select>
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className = "", ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        required={required}
        className={`${baseInputClass} ${withError(error)} ${className}`}
        {...rest}
      />
    </Field>
  );
});
