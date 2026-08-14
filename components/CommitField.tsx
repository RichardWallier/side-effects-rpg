"use client";

import { useEffect, useState } from "react";

/**
 * Campo de texto que edita local e só grava no blur — mesmo comportamento do
 * `onchange` do protótipo. Reincorpora valor externo (Realtime) enquanto não
 * está focado, pra não brigar com quem está digitando.
 */
export function CommitField({
  value,
  onCommit,
  disabled,
  rows,
  placeholder,
  id,
}: {
  value: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    if (draft !== value) onCommit(draft);
  };

  const shared = {
    id,
    value: draft,
    disabled,
    placeholder,
    onFocus: () => setFocused(true),
    onBlur: commit,
  };

  if (rows) {
    return (
      <textarea
        {...shared}
        rows={rows}
        onChange={(e) => setDraft(e.target.value)}
      />
    );
  }

  return (
    <input
      {...shared}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
