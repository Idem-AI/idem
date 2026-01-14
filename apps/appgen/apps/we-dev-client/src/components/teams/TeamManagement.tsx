import { useState } from 'react';
import { useAuth } from '@idem/shared-auth-client';
import { authClient } from '../../lib/authClient';
import { CreateTeamModal } from './CreateTeamModal';
import { InviteUserModal } from './InviteUserModal';
import { TeamCard } from './TeamCard';

export function TeamManagement() {
  const { teams, loading, error, createTeam, inviteUser, refetchTeams } = useAuth(authClient);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-600">Error: {error.message}</p>
          <button
            onClick={() => refetchTeams()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Teams</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          + Create Team
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">You don't have any teams yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Create Your First Team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} onInvite={() => setShowInviteModal(team.id!)} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (name, description) => {
            await createTeam(name, description);
            setShowCreateModal(false);
          }}
        />
      )}

      {showInviteModal && (
        <InviteUserModal
          teamId={showInviteModal}
          onClose={() => setShowInviteModal(null)}
          onInvite={async (email, displayName, role) => {
            await inviteUser(email, displayName, showInviteModal, role);
            setShowInviteModal(null);
          }}
        />
      )}
    </div>
  );
}
