import { useEffect, useRef, useState } from 'react';

interface InlineEditProps {
  value: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InlineEdit({ value, onSubmit, onCancel }: InlineEditProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(editValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    onSubmit(editValue);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="bg-white text-gray-900 dark:bg-surface-3 dark:text-white px-1 rounded outline-none border border-[var(--glass-border)] w-full"
      onClick={(e) => e.stopPropagation()}
    />
  );
}