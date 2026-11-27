import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import {
  INVITATION_TTL_DAYS,
  ProjectGroupView,
  ProjectMemberView,
  ProjectPermissions,
  ProjectTeamView,
  hasAnySpace,
  uniformPermissions,
} from '@idem/shared-models';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { PalaverTreeIllustrationComponent } from '../../../../shared/components/palaver-tree-illustration/palaver-tree-illustration';
import { TeamService } from '../../services/team.service';
import { PermissionsEditorComponent } from '../../components/permissions-editor/permissions-editor';
import { RolePickerComponent } from '../../components/role-picker/role-picker';
import { AccessSummaryComponent } from '../../components/access-summary/access-summary';
import { RoleOption, optionKeyOf, roleInputOf, roleOptions } from '../../team-spaces';

type MemberState = 'active' | 'pending' | 'declined' | 'expired';

interface GroupDraft {
  id: string | null;
  name: string;
  permissions: ProjectPermissions;
}

/**
 * L'équipe d'un projet : inviter, régler les accès, regrouper.
 *
 * Trois blocs, dans l'ordre où on en a besoin : inviter quelqu'un (le geste
 * principal), voir qui a accès à quoi, et — pour qui a plusieurs personnes aux
 * mêmes droits — les groupes. Chaque choix se fait par des mots (« Voir »,
 * « Modifier ») et des rôles nommés, jamais par une grille technique ; le
 * réglage espace par espace n'apparaît que si on le demande (« Sur mesure »).
 */
@Component({
  selector: 'app-team-page',
  imports: [
    TranslateModule,
    IdemLoaderComponent,
    PalaverTreeIllustrationComponent,
    PermissionsEditorComponent,
    RolePickerComponent,
    AccessSummaryComponent,
  ],
  templateUrl: './team-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPage {
  private readonly teamService = inject(TeamService);
  private readonly projects = inject(CurrentProjectService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  protected readonly team = signal<ProjectTeamView | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);

  protected readonly options = computed<RoleOption[]>(() => roleOptions(this.team()?.groups ?? []));

  // ─── Inviter ──────────────────────────────────────────────────────────────
  protected readonly email = signal('');
  // Par défaut, le rôle le plus prudent : on ouvre plus ensuite si besoin.
  protected readonly inviteKey = signal('viewer');
  protected readonly inviteCustom = signal<ProjectPermissions>(uniformPermissions('none'));
  protected readonly inviting = signal(false);
  protected readonly inviteError = signal<string | null>(null);

  protected readonly inviteOption = computed(() => this.optionOf(this.inviteKey()));
  protected readonly canInvite = computed(() => {
    const option = this.inviteOption();
    if (!this.email().trim() || !option || this.inviting()) return false;
    return option.roleKey !== 'custom' || hasAnySpace(this.inviteCustom());
  });

  // ─── Modifier un membre ──────────────────────────────────────────────────
  protected readonly editingId = signal<string | null>(null);
  protected readonly editKey = signal('viewer');
  protected readonly editCustom = signal<ProjectPermissions>(uniformPermissions('none'));
  protected readonly savingMember = signal(false);
  protected readonly busyMemberId = signal<string | null>(null);
  protected readonly toRemove = signal<ProjectMemberView | null>(null);

  protected readonly editOption = computed(() => this.optionOf(this.editKey()));

  // ─── Groupes ──────────────────────────────────────────────────────────────
  protected readonly groupDraft = signal<GroupDraft | null>(null);
  protected readonly savingGroup = signal(false);
  protected readonly groupError = signal<string | null>(null);
  protected readonly toDeleteGroup = signal<ProjectGroupView | null>(null);

  constructor() {
    // Changer de projet dans la barre du haut recharge l'équipe du nouveau projet.
    effect(() => {
      const projectId = this.projects.selectedId();
      untracked(() => this.load(projectId));
    });
  }

  protected projectId(): string {
    return this.projects.selectedId() ?? '';
  }

  private optionOf(key: string): RoleOption | undefined {
    return this.options().find((option) => option.key === key);
  }

  private load(projectId: string | null): void {
    if (!projectId) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.teamService.team(projectId).subscribe({
      next: (team) => {
        this.team.set(team);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        // Pas propriétaire de ce projet : la page n'existe pas pour lui.
        if (TeamService.errorCode(error) === 'not_owner') {
          void this.router.navigate(['/not-found'], { replaceUrl: true });
          return;
        }
        this.loadFailed.set(true);
      },
    });
  }

  protected retry(): void {
    this.load(this.projectId());
  }

  // ─── Affichage ────────────────────────────────────────────────────────────

  protected initials(person: { displayName?: string; email?: string }): string {
    const source = (person.displayName || person.email || '?').trim();
    const parts = source.split(/[\s@.]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  protected stateOf(member: ProjectMemberView): MemberState {
    if (member.status !== 'pending') return member.status;
    const age = Date.now() - new Date(member.invitedAt).getTime();
    return age > INVITATION_TTL_DAYS * 24 * 3600 * 1000 ? 'expired' : 'pending';
  }

  protected roleLabel(member: ProjectMemberView): string {
    const option = this.optionOf(optionKeyOf(member.roleKey, member.groupId));
    if (!option) return this.translate.instant('team.roles.custom.label');
    return option.label ?? this.translate.instant(option.labelKey ?? '');
  }

  protected errorText(code: string): string {
    const key = `team.errors.${code}`;
    const text = this.translate.instant(key);
    return text === key ? this.translate.instant('team.errors.generic') : text;
  }

  // ─── Inviter ──────────────────────────────────────────────────────────────

  protected onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.inviteError.set(null);
  }

  protected invite(event: Event): void {
    event.preventDefault();
    const option = this.inviteOption();
    if (!option || !this.canInvite()) return;
    const email = this.email().trim();
    this.inviting.set(true);
    this.inviteError.set(null);
    this.teamService.invite(this.projectId(), email, roleInputOf(option, this.inviteCustom())).subscribe({
      next: (team) => {
        this.team.set(team);
        this.inviting.set(false);
        this.email.set('');
        this.notifications.showSuccess({
          title: this.translate.instant('team.invite.sentTitle'),
          message: this.translate.instant('team.invite.sentBody', { email }),
        });
      },
      error: (error) => {
        this.inviting.set(false);
        this.inviteError.set(TeamService.errorCode(error));
      },
    });
  }

  // ─── Membres ──────────────────────────────────────────────────────────────

  protected startEdit(member: ProjectMemberView): void {
    this.editingId.set(member.id);
    this.editKey.set(optionKeyOf(member.roleKey, member.groupId));
    this.editCustom.set({ ...member.permissions });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected onEditKey(key: string): void {
    // Passer à « Sur mesure » part des droits actuels du rôle choisi avant.
    if (key === 'custom') {
      const previous = this.editOption()?.permissions;
      if (previous) this.editCustom.set({ ...previous });
    }
    this.editKey.set(key);
  }

  protected onInviteKey(key: string): void {
    if (key === 'custom') {
      const previous = this.inviteOption()?.permissions;
      if (previous) this.inviteCustom.set({ ...previous });
    }
    this.inviteKey.set(key);
  }

  protected saveMember(member: ProjectMemberView): void {
    const option = this.editOption();
    if (!option || this.savingMember()) return;
    if (option.roleKey === 'custom' && !hasAnySpace(this.editCustom())) return;
    this.savingMember.set(true);
    this.teamService.updateMember(this.projectId(), member.id, roleInputOf(option, this.editCustom())).subscribe({
      next: (team) => {
        this.team.set(team);
        this.savingMember.set(false);
        this.editingId.set(null);
        this.notifications.showSuccess({ title: this.translate.instant('team.members.savedTitle'), message: this.translate.instant('team.members.savedBody') });
      },
      error: (error) => {
        this.savingMember.set(false);
        this.notifications.showError({ title: this.translate.instant('team.errors.title'), message: this.errorText(TeamService.errorCode(error)) });
      },
    });
  }

  protected resend(member: ProjectMemberView): void {
    this.busyMemberId.set(member.id);
    this.teamService.resend(this.projectId(), member.id).subscribe({
      next: (team) => {
        this.team.set(team);
        this.busyMemberId.set(null);
        this.notifications.showSuccess({
          title: this.translate.instant('team.invite.sentTitle'),
          message: this.translate.instant('team.invite.sentBody', { email: member.email }),
        });
      },
      error: (error) => {
        this.busyMemberId.set(null);
        this.notifications.showError({ title: this.translate.instant('team.errors.title'), message: this.errorText(TeamService.errorCode(error)) });
      },
    });
  }

  protected confirmRemove(): void {
    const member = this.toRemove();
    if (!member) return;
    this.busyMemberId.set(member.id);
    this.teamService.removeMember(this.projectId(), member.id).subscribe({
      next: (team) => {
        this.team.set(team);
        this.busyMemberId.set(null);
        this.toRemove.set(null);
      },
      error: (error) => {
        this.busyMemberId.set(null);
        this.notifications.showError({ title: this.translate.instant('team.errors.title'), message: this.errorText(TeamService.errorCode(error)) });
      },
    });
  }

  // ─── Groupes ──────────────────────────────────────────────────────────────

  protected newGroup(): void {
    this.groupError.set(null);
    this.groupDraft.set({ id: null, name: '', permissions: uniformPermissions('none') });
  }

  protected editGroup(group: ProjectGroupView): void {
    this.groupError.set(null);
    this.groupDraft.set({ id: group.id, name: group.name, permissions: { ...group.permissions } });
  }

  protected onGroupName(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.groupDraft.update((draft) => (draft ? { ...draft, name } : draft));
    this.groupError.set(null);
  }

  protected onGroupPermissions(permissions: ProjectPermissions): void {
    this.groupDraft.update((draft) => (draft ? { ...draft, permissions } : draft));
    this.groupError.set(null);
  }

  protected saveGroup(event: Event): void {
    event.preventDefault();
    const draft = this.groupDraft();
    if (!draft || this.savingGroup()) return;
    if (!draft.name.trim()) {
      this.groupError.set('invalid_name');
      return;
    }
    if (!hasAnySpace(draft.permissions)) {
      this.groupError.set('empty_permissions');
      return;
    }
    this.savingGroup.set(true);
    const request = draft.id
      ? this.teamService.updateGroup(this.projectId(), draft.id, { name: draft.name.trim(), permissions: draft.permissions })
      : this.teamService.createGroup(this.projectId(), draft.name.trim(), draft.permissions);
    request.subscribe({
      next: (team) => {
        this.team.set(team);
        this.savingGroup.set(false);
        this.groupDraft.set(null);
      },
      error: (error) => {
        this.savingGroup.set(false);
        this.groupError.set(TeamService.errorCode(error));
      },
    });
  }

  protected confirmDeleteGroup(): void {
    const group = this.toDeleteGroup();
    if (!group) return;
    this.savingGroup.set(true);
    this.teamService.deleteGroup(this.projectId(), group.id).subscribe({
      next: (team) => {
        this.team.set(team);
        this.savingGroup.set(false);
        this.toDeleteGroup.set(null);
      },
      error: (error) => {
        this.savingGroup.set(false);
        this.notifications.showError({ title: this.translate.instant('team.errors.title'), message: this.errorText(TeamService.errorCode(error)) });
      },
    });
  }
}
