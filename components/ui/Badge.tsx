import { cn } from "@/lib/utils";

export default function Badge({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        title && "cursor-help",
        className ?? "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      {children}
    </span>
  );
}
