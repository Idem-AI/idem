import { Pencil, Trash2, FileText } from 'lucide-react';

interface FileContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function FileContextMenu({ x, y, path, onClose, onRename, onDelete }: FileContextMenuProps) {
  const menuItems = [
    {
      label: 'Rename',
      icon: Pencil,
      onClick: onRename
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: onDelete
    }
  ];

  return (
    <div
      className="bg-surface-1 border border-gray-200 dark:border-[var(--glass-border)] rounded shadow-lg z-50"
      style={{
        position: 'absolute',
        left: x,
        top: y
      }}
    >
      <div className="px-3 py-1.5 text-[13px] text-text-tertiary border-b border-gray-200 dark:border-[var(--glass-border)] flex items-center">
        <FileText className="w-3.5 h-3.5 mr-1.5 text-[#6b9fed]" />
        {path.split('/').pop()}
      </div>
      {menuItems.map((item, index) => (
        <button
          key={index}
          className="w-full px-3 py-1.5 text-[13px] text-left text-text-secondary hover:bg-gray-100 dark:hover:bg-surface-2 flex items-center"
          onClick={item.onClick}
        >
          <item.icon className="w-3.5 h-3.5 mr-1.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}