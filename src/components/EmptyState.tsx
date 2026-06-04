type EmptyStateProps = {
  title: string;
  detail: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export default function EmptyState({ title, detail, action }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-[#252a3d] bg-[#0b0d14] px-3 py-3 text-left">
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">{title}</div>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-600 font-mono">{detail}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded border border-[#7b9cf5]/30 bg-[#7b9cf5]/10 px-2 py-1 text-[8.5px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
