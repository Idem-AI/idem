import { FolderPlus, FilePlus, Pencil, Trash2, Folder } from 'lucide-react';

interface FolderContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
}

export function FolderContextMenu({
  x,
  y,
  path,
  onClose,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder
}: FolderContextMenuProps) {
  const menuItems = [
    {
      label: 'New File',
      icon: FilePlus,
      onClick: () => {
        onCreateFile();
        onClose();
      }
    },
    {
      label: 'New Folder',
      icon: FolderPlus,
      onClick: () => {
        onCreateFolder();
        onClose();
      }
    },
    ...(path ? [
      {
        label: 'Rename',
        icon: Pencil,
        onClick: () => {
          onRename();
          onClose();
        }
      },
      {
        label: 'Delete',
        icon: Trash2,
        onClick: () => {
          onDelete();
          onClose();
        }
      }
    ] : [])
  ];

  return (
    <div
      className="bg-surface-1 border border-[var(--glass-border)] rounded shadow-lg z-50"
      style={{
        position: 'absolute',
        left: x,
        top: y
      }}
    >
      {path && (
        <div className="px-3 py-1.5 text-[13px] text-gray-400 border-b border-[var(--glass-border)] flex items-center">
          <Folder className="w-3.5 h-3.5 mr-1.5 text-[#dcb67a]" />
          {path.split('/').pop()}
        </div>
      )}
      {menuItems.map((item, index) => (
        <button
          key={index}
          className="w-full px-3 py-1.5 text-[13px] text-left hover:bg-surface-2 flex items-center"
          onClick={item.onClick}
        >
          <item.icon className="w-3.5 h-3.5 mr-1.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}