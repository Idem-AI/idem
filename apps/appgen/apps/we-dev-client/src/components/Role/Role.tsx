import React from 'react';
import { RoleAvatar } from './RoleAvatar';

export interface RoleProps {
  name: string;
  title: string;
  type: 'leader' | 'manager' | 'architect' | 'engineer' | 'analyst';
  avatar?: string;
}

export const Role: React.FC<RoleProps> = ({ name, title, type, avatar }) => {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4 gap-3">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
        <RoleAvatar type={type} />
      </div>
      <div className="flex flex-col">
        <span className="text-gray-900 dark:text-white font-medium">{name}</span>
        <span className="text-gray-500 dark:text-gray-400 text-sm">{title}</span>
      </div>
    </div>
  );
}; 