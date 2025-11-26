// Core
export { AuthClient } from './core/AuthClient';
export type { AuthClientConfig } from './core/AuthClient';

// React hooks (optional - only if React is available)
export { useAuth, useProjectPermissions } from './react/useAuth';
export type { UseAuthReturn, UseProjectPermissionsReturn } from './react/useAuth';

// Svelte stores (optional - only if Svelte is available)
export { createAuthStore, createProjectPermissionsStore } from './svelte/authStore';
export type { AuthState, ProjectPermissionsState } from './svelte/authStore';

// Angular services (optional - only if Angular is available)
export { AuthService, ProjectPermissionsService } from './angular/auth.service';

// Re-export types from shared-models for convenience
export type {
  UserModel,
  TeamModel,
  ProjectModel,
  CreateTeamDTO,
  AddTeamMemberDTO,
  CreateInvitationDTO,
  RolePermissions,
  ProjectTeamRole,
  TeamRole,
} from '@idem/shared-models';
