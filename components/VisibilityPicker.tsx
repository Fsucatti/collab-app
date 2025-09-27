"use client";

type Props = {
  value: "private" | "team" | "public";
  onChange: (v: Props["value"]) => void;
  disabled?: boolean;
};

export default function VisibilityPicker({ value, onChange, disabled }: Props) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-xs text-muted">Visibility</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Props["value"])}
        disabled={disabled}
        className="
          rounded-md border border-border bg-card px-2 py-1.5 text-sm text-fg
          hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-ring
          disabled:opacity-60 dark:hover:bg-brand-900/30
        "
      >
        <option value="private">Private</option>
        <option value="team">Team</option>
        <option value="public">Public</option>
      </select>
    </label>
  );
}
