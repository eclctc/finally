interface PanelProps {
  title: string;
  testId?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  dataAttributes?: Record<string, string>;
}

/** Titled, bordered container used for every dashboard section. */
export function Panel({ title, testId, actions, className = "", children, dataAttributes }: PanelProps) {
  return (
    <section
      data-testid={testId}
      {...dataAttributes}
      className={`flex min-h-0 flex-col border border-line bg-panel ${className}`}
    >
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <h2 className="text-[12px] font-medium text-muted">{title}</h2>
        {actions}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
