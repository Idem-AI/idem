import { FileText, FolderIcon, Pencil, Trash2 } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  item: {
    name: string;
    type: 'file' | 'folder';
    path: string;
  };
  onClose: () => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

export function ContextMenu({ x, y, item, onClose, onRename, onDelete }: ContextMenuProps) {
  const menuItems = [
    {
      label: 'Rename',
      icon: Pencil,
      onClick: () => onRename(item.path)
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => {
        if (confirm(`Are you sure you want to delete ${item.name}?`)) {
          onDelete(item.path);
        }
      }
    }
  ];

  return (
    <div
      className="fixed bg-surface-1 border border-gray-200 dark:border-[var(--glass-border)] rounded shadow-lg py-1 z-50"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1.5 text-[13px] text-text-tertiary border-b border-gray-200 dark:border-[var(--glass-border)] flex items-center">
        {item.type === 'folder' ? (
          <FolderIcon className="w-3.5 h-3.5 mr-1.5 text-[#dcb67a]" />
        ) : (
          <FileText className="w-3.5 h-3.5 mr-1.5 text-[#6b9fed]" />
        )}
        {item.name}
      </div>
      {menuItems.map((menuItem, index) => (
        <button
          key={index}
          className="w-full px-3 py-1.5 text-[13px] text-left text-text-secondary hover:bg-gray-100 dark:hover:bg-surface-2 flex items-center"
          onClick={() => {
            menuItem.onClick();
            onClose();
          }}
        >
          <menuItem.icon className="w-3.5 h-3.5 mr-1.5" />
          {menuItem.label}
        </button>
      ))}
    </div>
  );
}