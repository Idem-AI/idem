import { cn } from "@/utils/cn";
import { SearchBar } from "./components/SearchBar";
import { SearchResults } from "./components/SearchResults";
import { useFileSearch } from "./hooks/useFileSearch";
import "./styles/search.css";

interface SearchProps {
  onFileSelect: (path: string, line?: number) => void;
}

export function Search({ onFileSelect }: SearchProps) {
  const {
    searchResults,
    currentMatchIndex,
    totalMatches,
    handleSearch,
    navigateMatch,
  } = useFileSearch();

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        "bg-surface-1",
        "text-text-secondary"
      )}
    >
      <div
        className={cn(
          "p-2",
          "border-b border-[var(--glass-border)]",
          "bg-surface-1",
          "shadow-[0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-none"
        )}
      >
        <SearchBar
          onSearch={handleSearch}
          totalResults={totalMatches}
          currentMatch={totalMatches > 0 ? currentMatchIndex + 1 : 0}
          onNavigate={navigateMatch}
        />
      </div>
      <div
        className={cn(
          "flex-1 overflow-hidden",
          "p-2",
          "bg-surface-1"
        )}
      >
        <SearchResults
          results={searchResults}
          currentMatchIndex={currentMatchIndex}
          onFileSelect={onFileSelect}
        />
      </div>
    </div>
  );
}
