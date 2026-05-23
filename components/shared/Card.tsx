import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function Card({ title, children, className, action }: Props) {
  return (
    <div className={cn("bg-[var(--card)] border border-[var(--card-border)] rounded-xl", className)}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--card-border)]">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn(!title && "p-5")}>{children}</div>
    </div>
  );
}
