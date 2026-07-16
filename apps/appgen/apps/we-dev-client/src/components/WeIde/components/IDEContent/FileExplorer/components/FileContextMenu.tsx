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
      className="bg-white dark:bg-[#18181a] border border-gray-200 dark:border-[#3c3c3c] rounded shadow-lg z-50"
      style={{
        position: 'absolute',
        left: x,
        top: y
      }}
    >
      <div className="px-3 py-1.5 text-[13px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#454545] flex items-center">
        <FileText className="w-3.5 h-3.5 mr-1.5 text-[#6b9fed]" />
        {path.split('/').pop()}
      </div>
      {menuItems.map((item, index) => (
        <button
          key={index}
          className="w-full px-3 py-1.5 text-[13px] text-left text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2d2d2d] flex items-center"
          onClick={item.onClick}
        >
          <item.icon className="w-3.5 h-3.5 mr-1.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}