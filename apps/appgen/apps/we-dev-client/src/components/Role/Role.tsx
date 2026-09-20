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
    <div className="flex items-center bg-surface-2 rounded-lg p-4 gap-3">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-3 flex items-center justify-center">
        <RoleAvatar type={type} />
      </div>
      <div className="flex flex-col">
        <span className="text-text-primary font-medium">{name}</span>
        <span className="text-text-tertiary text-sm">{title}</span>
      </div>
    </div>
  );
}; 