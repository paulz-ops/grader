import { useEffect, useState, type ReactNode } from 'react';
import { describeRounding } from '../grades';
import { parseNumber } from '../format';
import type { GradeSystem } from '../types';

interface TextFieldProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  type?: 'text' | 'date';
}

/** Eingabefeld, das erst beim Verlassen (oder Enter) speichert. */
export function TextField({ value, onSave, className, placeholder, ariaLabel, inputMode, type = 'text' }: TextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type={type}
      className={className}
      value={draft ?? value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      inputMode={inputMode}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onSave(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

interface RoundingFieldProps {
  label: string;
  value: number;
  system: GradeSystem;
  onSave: (value: number) => void;
}

/** Auswahl der Rundungsregel mit Beispiel. */
export function RoundingField({ label, value, system, onSave }: RoundingFieldProps) {
  const isPreset = value === 0.5 || value === 0.51;
  const [custom, setCustom] = useState(!isPreset);
  useEffect(() => {
    if (!isPreset) setCustom(true);
  }, [isPreset]);
  const mode = custom ? 'custom' : String(value);

  return (
    <Field label={label} hint={describeRounding(value, system)}>
      <select
        value={mode}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setCustom(true);
          } else {
            setCustom(false);
            onSave(Number(e.target.value));
          }
        }}
      >
        <option value="0.5">Kaufmännisch (ab x,50 aufrunden)</option>
        <option value="0.51">Erst ab x,51 aufrunden</option>
        <option value="custom">Eigene Grenze …</option>
      </select>
      {mode === 'custom' && (
        <TextField
          className="short"
          inputMode="decimal"
          ariaLabel="Eigene Rundungsgrenze"
          value={String(value).replace('.', ',')}
          onSave={(v) => {
            const n = parseNumber(v);
            if (n !== null && n > 0 && n < 1) onSave(Math.round(n * 100) / 100);
          }}
        />
      )}
    </Field>
  );
}
