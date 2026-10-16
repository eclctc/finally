import { useId } from "react";

interface PanelProps {
  title: string;
  testId?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Titled, bordered container used for every dashboard area. */
export function Panel({ title, testId, className = "", children }: PanelProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      data-testid={testId}
      className={`flex min-h-0 flex-col border border-line bg-panel ${className}`}
    >
      <header className="flex h-8 shrink-0 items-center border-b border-line px-2">
        <h2 id={titleId} className="truncate text-[11px] font-semibold text-muted">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
