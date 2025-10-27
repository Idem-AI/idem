/**
 * Exemple d'intégration React pour appgen
 *
 * Installation:
 * npm install @idem/shared-auth-client firebase
 */

import React, { createContext, useContext, useMemo } from 'react';
import { AuthClient, useAuth, useProjectPermissions } from '@idem/shared-auth-client';
import { getAuth } from 'firebase/auth';

// 1. Créer le contexte AuthClient
const AuthClientContext = createContext<AuthClient | null>(null);

// 2. Provider pour l'application
export function AuthClientProvider({ children }: { children: React.ReactNode }) {
  const authClient = useMemo(() => {
    return new AuthClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
      getAuthToken: async () => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          return await user.getIdToken();
        }
        return null;
      },
    });
  }, []);

  return <AuthClientContext.Provider value={authClient}>{children}</AuthClientContext.Provider>;
}

// 3. Hook pour accéder au client
export function useAuthClient() {
  const client = useContext(AuthClientContext);
  if (!client) {
    throw new Error('useAuthClient must be used within AuthClientProvider');
  }
  return client;
}

// 4. Composant de gestion des équipes
export function TeamManagement() {
  const authClient = useAuthClient();
  const { teams, loading, error, createTeam, inviteUser } = useAuth(authClient);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showInviteModal, setShowInviteModal] = React.useState<string | null>(null);

  if (loading) {
    return <div className="loading">Loading teams...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="team-management">
      <div className="header">
        <h1>My Teams</h1>
        <button onClick={() => setShowCreateModal(true)}>Create Team</button>
      </div>

      <div className="teams-grid">
        {teams.map((team) => (
          <div key={team.id} className="team-card">
            <h2>{team.name}</h2>
            <p>{team.description}</p>
            <p className="members-count">
              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
            </p>

            <div className="members-list">
              {team.members.map((member) => (
                <div key={member.userId} className="member">
                  <span>{member.displayName}</span>
                  <span className="role">{member.role}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setShowInviteModal(team.id!)}>Invite User</button>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <CreateTeamModal onClose={() => setShowCreateModal(false)} onCreate={createTeam} />
      )}

      {showInviteModal && (
        <InviteUserModal
          teamId={showInviteModal}
          onClose={() => setShowInviteModal(null)}
          onInvite={inviteUser}
        />
      )}
    </div>
  );
}

// 5. Composant avec vérification de permissions
export function ProjectActions({ projectId }: { projectId: string }) {
  const authClient = useAuthClient();
  const { permissions, loading, hasPermission } = useProjectPermissions(authClient, projectId);

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="project-actions">
      {hasPermission('canEdit') && (
        <button onClick={() => console.log('Edit project')}>Edit Project</button>
      )}

      {hasPermission('canDeploy') && (
        <button onClick={() => console.log('Deploy project')}>Deploy</button>
      )}

      {hasPermission('canDelete') && (
        <button onClick={() => console.log('Delete project')} className="danger">
          Delete Project
        </button>
      )}

      {hasPermission('canManageTeams') && (
        <button onClick={() => console.log('Manage teams')}>Manage Teams</button>
      )}

      {!permissions && <div className="no-access">You don't have access to this project</div>}
    </div>
  );
}

// 6. Modals (exemples simplifiés)
function CreateTeamModal({ onClose, onCreate }: any) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate(name, description);
    onClose();
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <h2>Create Team</h2>
        <input
          type="text"
          placeholder="Team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Create</button>
        </div>
      </form>
    </div>
  );
}

function InviteUserModal({ teamId, onClose, onInvite }: any) {
  const [email, setEmail] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [role, setRole] = React.useState('member');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onInvite(email, displayName, teamId, role);
    alert('Invitation sent!');
    onClose();
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <h2>Invite User</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
        <div className="actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Send Invitation</button>
        </div>
      </form>
    </div>
  );
}

// 7. Utilisation dans App.tsx
export function App() {
  return (
    <AuthClientProvider>
      <div className="app">
        <TeamManagement />
        {/* Autres composants */}
      </div>
    </AuthClientProvider>
  );
}
