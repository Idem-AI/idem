import React from 'react';
import type { UserModel } from '../../api/persistence/userModel';

interface UserProfileProps {
  user: UserModel;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  // Function to get initials from name (display name or email)
  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  // Display name is preferred, fallback to email
  const displayName = user.displayName || user.email;
  const initials = getInitials(user.displayName || user.email);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          w-8 h-8 rounded-full
          flex items-center justify-center
          text-white text-xs font-medium
          ${user.photoURL ? '' : 'bg-purple-500 dark:bg-purple-600'}
        `}
        style={
          user.photoURL
            ? {
                backgroundImage: `url(${user.photoURL})`,
                backgroundSize: 'cover',
              }
            : undefined
        }
      >
        {!user.photoURL && initials}
      </div>
      <div className="hidden md:block">
        <div className="dark:text-white text-[13px] font-medium truncate max-w-[100px]">
          {displayName}
        </div>
        <div className="text-[11px] text-gray-400 uppercase">
          {user.subscription} plan
        </div>
      </div>
    </div>
  );
};
