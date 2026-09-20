import { useState } from 'react';
import { isValidFileName } from '../utils/fileSystem';

interface CreateFolderDialogProps {
  path: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function CreateFolderDialog({ path, onSubmit, onCancel }: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidFileName(folderName)) {
      setError('Invalid folder name. Please avoid special characters.');
      return;
    }

    onSubmit(folderName);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form 
        onSubmit={handleSubmit}
        className="bg-white text-gray-900 dark:bg-surface-1 dark:text-gray-200 rounded-lg shadow-xl w-[400px] p-4"
      >
        <h2 className="text-sm font-semibold mb-4">Create New Folder</h2>
        <div className="mb-4">
          <input
            type="text"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setError('');
            }}
            placeholder="Enter folder name"
            className="w-full px-3 py-2 bg-surface-3 text-text-primary rounded border border-gray-300 dark:border-[var(--glass-border)] text-sm focus:border-[var(--glass-border)] outline-none placeholder-gray-500 dark:placeholder-gray-400"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          {path && (
            <p className="text-xs text-text-tertiary mt-1">
              Will be created in: {path}
            </p>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-surface-2 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!folderName.trim()}
            className="px-3 py-1.5 text-sm bg-primary hover:bg-primary text-white rounded disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}