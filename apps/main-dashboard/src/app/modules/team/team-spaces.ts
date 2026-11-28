import {
  MemberRoleInput,
  MemberRoleKey,
  PROJECT_SPACES,
  ProjectGroupView,
  ProjectPermissions,
  ProjectSpace,
  ROLE_PRESETS,
  ROLE_PRESET_PERMISSIONS,
  RolePreset,
} from '@idem/shared-models';

/** Les icônes des espaces : celles du menu latéral, pour qu'on les reconnaisse. */
export const SPACE_ICONS: Record<ProjectSpace, string> = {
  branding: 'pi pi-palette',
  businessPlan: 'pi pi-briefcase',
  pitchDeck: 'pi pi-desktop',
  finance: 'pi pi-chart-line',
  legal: 'pi pi-file-edit',
  communication: 'pi pi-megaphone',
  website: 'pi pi-globe',
  deployment: 'pi pi-send',
  simulation: 'pi pi-bolt',
  advisor: 'pi pi-comments',
};

/** Les trois niveaux, chacun avec son pictogramme : on lit « 👁 Voir », « ✎ Modifier ». */
export const LEVEL_ICONS: Record<'none' | 'read' | 'write', string> = {
  none: 'pi pi-ban',
  read: 'pi pi-eye',
  write: 'pi pi-pencil',
};

/** Un pictogramme par rôle : on reconnaît la carte avant de la lire. */
export const ROLE_ICONS: Record<string, string> = {
  partner: 'pi pi-star',
  viewer: 'pi pi-eye',
  marketing: 'pi pi-megaphone',
  web: 'pi pi-globe',
  finance: 'pi pi-chart-line',
  group: 'pi pi-users',
  custom: 'pi pi-sliders-h',
};

/**
 * Un choix de rôle tel que l'écran le propose : rôle prêt à l'emploi, groupe
 * du projet, ou réglage sur mesure. `key` est unique dans la liste.
 */
export interface RoleOption {
  key: string;
  roleKey: MemberRoleKey;
  groupId?: string;
  /** Clé de traduction du nom (rôles) ou nom tel quel (groupes). */
  labelKey?: string;
  label?: string;
  hintKey?: string;
  icon: string;
  permissions: ProjectPermissions | null;
}

export function roleOptions(groups: ProjectGroupView[]): RoleOption[] {
  const presets: RoleOption[] = ROLE_PRESETS.map((preset: RolePreset) => ({
    key: preset,
    roleKey: preset,
    labelKey: `team.roles.${preset}.label`,
    hintKey: `team.roles.${preset}.hint`,
    icon: ROLE_ICONS[preset],
    permissions: ROLE_PRESET_PERMISSIONS[preset],
  }));
  const groupOptions: RoleOption[] = groups.map((group) => ({
    key: `group:${group.id}`,
    roleKey: 'group',
    groupId: group.id,
    label: group.name,
    hintKey: 'team.roles.groupHint',
    icon: ROLE_ICONS['group'],
    permissions: group.permissions,
  }));
  return [
    ...presets,
    ...groupOptions,
    { key: 'custom', roleKey: 'custom', labelKey: 'team.roles.custom.label', hintKey: 'team.roles.custom.hint', icon: ROLE_ICONS['custom'], permissions: null },
  ];
}

export function optionKeyOf(roleKey: MemberRoleKey, groupId?: string | null): string {
  return roleKey === 'group' ? `group:${groupId ?? ''}` : roleKey;
}

export function roleInputOf(option: RoleOption, custom: ProjectPermissions): MemberRoleInput {
  if (option.roleKey === 'group') return { roleKey: 'group', groupId: option.groupId };
  if (option.roleKey === 'custom') return { roleKey: 'custom', permissions: custom };
  return { roleKey: option.roleKey };
}

/** Les espaces ouverts, rangés : d'abord ce qu'on modifie, puis ce qu'on consulte. */
export function summarize(permissions: ProjectPermissions): { write: ProjectSpace[]; read: ProjectSpace[] } {
  return {
    write: PROJECT_SPACES.filter((space) => permissions[space] === 'write'),
    read: PROJECT_SPACES.filter((space) => permissions[space] === 'read'),
  };
}
