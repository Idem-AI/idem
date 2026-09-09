import { useState } from 'react';
import { isValidFileName } from '../utils/fileSystem';

interface CreateFileDialogProps {
  path: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function CreateFileDialog({ path, onSubmit, onCancel }: CreateFileDialogProps) {
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidFileName(fileName)) {
      setError('Invalid file name. Please avoid special characters.');
      return;
    }

    onSubmit(fileName);
  };

  return (
    <div className="fixed inset-0 bg-black/20 dark:bg-black/50 flex items-center justify-center z-50">
      <form 
        onSubmit={handleSubmit}
        className="bg-surface-1 rounded-lg shadow-xl w-[400px] p-4 border border-[var(--glass-border)]"
      >
        <h2 className="text-sm font-semibold mb-4 text-text-secondary dark:text-white">Create New File</h2>
        <div className="mb-4">
          <input
            type="text"
            value={fileName}
            onChange={(e) => {
              setFileName(e.target.value);
              setError('');
            }}
            placeholder="Enter file name"
            className="w-full px-3 py-2 bg-surface-3 rounded border border-[var(--glass-border)] text-text-secondary dark:text-white text-sm focus:border-[var(--glass-border)] dark:focus:border-[var(--glass-border)] outline-none placeholder-[#767676] dark:placeholder-gray-400"
            autoFocus
          />
          {error && <p className="text-red-600 dark:text-red-500 text-xs mt-1">{error}</p>}
          {path && (
            <p className="text-xs text-[#767676] dark:text-gray-400 mt-1">
              Will be created in: {path}
            </p>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-secondary dark:text-white hover:bg-surface-3 dark:hover:bg-surface-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!fileName.trim()}
            className="px-3 py-1.5 text-sm bg-primary hover:bg-[#005ba4] dark:hover:bg-primary text-white rounded disabled:opacity-50 transition-colors"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}