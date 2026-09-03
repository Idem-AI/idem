import { useState, useRef } from 'react';
import { Search, X, ArrowUp, ArrowDown } from 'lucide-react';

import '../styles/search.css';
import { useTranslation } from "react-i18next";
import { cn } from '@/utils/cn';

interface SearchBarProps {
  onSearch: (query: string) => void;
  totalResults: number;
  currentMatch: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  className?: string;
}

export function SearchBar({ 
  onSearch, 
  totalResults, 
  currentMatch, 
  onNavigate,
  className 
}: SearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onNavigate('prev');
      } else {
        onNavigate('next');
      }
    }
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t("editor.search_in_files")}
          className="w-full h-7 pl-7 pr-20 text-[13px] rounded bg-surface-3 text-text-secondary dark:text-white border border-[var(--glass-border)] focus:border-[var(--glass-border)] dark:focus:border-[var(--glass-border)] outline-none placeholder-[#767676] dark:placeholder-gray-400"
        />
        {query && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
            {totalResults > 0 && (
              <span className="text-xs text-text-tertiary dark:text-gray-400">
                {currentMatch} of {totalResults}
              </span>
            )}
            <div className="flex items-center space-x-0.5">
              <button
                onClick={() => onNavigate('prev')}
                className="p-0.5 rounded text-text-secondary dark:text-gray-400 hover:bg-surface-3 dark:hover:bg-surface-2"
                title="Previous match (Shift+Enter)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('next')}
                className="p-0.5 rounded text-text-secondary dark:text-gray-400 hover:bg-surface-3 dark:hover:bg-surface-2"
                title="Next match (Enter)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={handleClear}
              className="p-0.5 rounded text-text-secondary dark:text-gray-400 hover:bg-surface-3 dark:hover:bg-surface-2"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}