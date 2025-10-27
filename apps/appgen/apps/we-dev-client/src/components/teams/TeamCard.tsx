import type { TeamModel } from '@idem/shared-auth-client';

interface TeamCardProps {
  team: TeamModel;
  onInvite: () => void;
}

export function TeamCard({ team, onInvite }: TeamCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{team.name}</h2>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
          {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
        </span>
      </div>

      {team.description && <p className="text-gray-600 text-sm mb-4">{team.description}</p>}

      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-medium text-gray-700">Members:</h3>
        <div className="space-y-1">
          {team.members.slice(0, 3).map((member) => (
            <div key={member.userId} className="flex justify-between items-center text-sm">
              <span className="text-gray-700">{member.displayName}</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                {member.role}
              </span>
            </div>
          ))}
          {team.members.length > 3 && (
            <p className="text-xs text-gray-500">+{team.members.length - 3} more</p>
          )}
        </div>
      </div>

      <button
        onClick={onInvite}
        className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-sm font-medium"
      >
        Invite User
      </button>
    </div>
  );
}
