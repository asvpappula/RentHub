"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const baseField =
  "w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ label, error, hint, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, ...props },
  ref
) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <input
        ref={ref}
        className={cn(baseField, "h-11", error && "border-rose-400", className)}
        {...props}
      />
    </FieldWrapper>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, hint, className, ...props }, ref) {
    return (
      <FieldWrapper label={label} error={error} hint={hint}>
        <textarea
          ref={ref}
          className={cn(baseField, "py-3 min-h-28", error && "border-rose-400", className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, children, ...props },
  ref
) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <select
        ref={ref}
        className={cn(baseField, "h-11", error && "border-rose-400", className)}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});
