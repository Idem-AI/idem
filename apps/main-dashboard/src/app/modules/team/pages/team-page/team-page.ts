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
import { TeamDrawerComponent } from '../../components/team-drawer/team-drawer';
import { RoleOption, optionKeyOf, roleInputOf, roleOptions } from '../../team-spaces';

type MemberState = 'active' | 'pending' | 'declined' | 'expired';
type Tab = 'members' | 'groups';

interface GroupDraft {
  id: string | null;
  name: string;
  permissions: ProjectPermissions;
}

type Drawer =
  | { kind: 'invite' }
  | { kind: 'member'; member: ProjectMemberView }
  | { kind: 'group'; draft: GroupDraft };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * L'équipe d'un projet.
 *
 * La page ne montre que deux choses : qui a accès, et à quoi — en pastilles
 * lisibles (« ✎ Communication », « 👁 Identité visuelle »). Tout geste
 * (inviter, changer les accès d'une personne, composer un groupe) se fait dans
 * un tiroir latéral, la liste restant visible derrière. Inviter se fait en
 * deux temps : « Qui ? » puis « Que pourra-t-elle faire ? », avec des rôles
 * nommés ; le réglage espace par espace n'apparaît que sur « Sur mesure ».
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
    TeamDrawerComponent,
  ],
  templateUrl: './team-page.html',
  styleUrl: './team-page.css',
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
  protected readonly tab = signal<Tab>('members');
  protected readonly drawer = signal<Drawer | null>(null);
  protected readonly saving = signal(false);
  protected readonly busyMemberId = signal<string | null>(null);

  protected readonly options = computed<RoleOption[]>(() => roleOptions(this.team()?.groups ?? []));
  protected readonly memberCount = computed(() => (this.team()?.members.length ?? 0) + 1);

  // ─── Tiroir « Inviter » ──────────────────────────────────────────────────
  protected readonly inviteStep = signal<1 | 2>(1);
  protected readonly email = signal('');
  // Par défaut le rôle le plus prudent : on ouvre plus ensuite si besoin.
  protected readonly roleKey = signal('viewer');
  protected readonly custom = signal<ProjectPermissions>(uniformPermissions('none'));
  protected readonly error = signal<string | null>(null);

  protected readonly roleOption = computed(() => this.options().find((option) => option.key === this.roleKey()));
  protected readonly emailValid = computed(() => EMAIL_RE.test(this.email().trim()));
  protected readonly roleReady = computed(() => {
    const option = this.roleOption();
    return !!option && (option.roleKey !== 'custom' || hasAnySpace(this.custom()));
  });

  // ─── Confirmations ───────────────────────────────────────────────────────
  protected readonly toRemove = signal<ProjectMemberView | null>(null);
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

  private load(projectId: string | null): void {
    if (!projectId) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.drawer.set(null);
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

  protected roleOf(member: ProjectMemberView): RoleOption | undefined {
    return this.options().find((option) => option.key === optionKeyOf(member.roleKey, member.groupId));
  }

  protected roleLabel(option: RoleOption | undefined): string {
    if (!option) return this.translate.instant('team.roles.custom.label');
    return option.label ?? this.translate.instant(option.labelKey ?? '');
  }

  protected errorText(code: string): string {
    const key = `team.errors.${code}`;
    const text = this.translate.instant(key);
    return text === key ? this.translate.instant('team.errors.generic') : text;
  }

  private fail(error: unknown): void {
    this.saving.set(false);
    this.busyMemberId.set(null);
    this.error.set(TeamService.errorCode(error));
  }

  private done(team: ProjectTeamView): void {
    this.team.set(team);
    this.saving.set(false);
    this.busyMemberId.set(null);
    this.drawer.set(null);
  }

  // ─── Tiroirs ──────────────────────────────────────────────────────────────

  protected openInvite(): void {
    this.inviteStep.set(1);
    this.email.set('');
    this.roleKey.set('viewer');
    this.custom.set(uniformPermissions('none'));
    this.error.set(null);
    this.drawer.set({ kind: 'invite' });
  }

  protected openMember(member: ProjectMemberView): void {
    this.roleKey.set(optionKeyOf(member.roleKey, member.groupId));
    this.custom.set({ ...member.permissions });
    this.error.set(null);
    this.drawer.set({ kind: 'member', member });
  }

  protected openGroup(group?: ProjectGroupView): void {
    this.error.set(null);
    this.drawer.set({
      kind: 'group',
      draft: group
        ? { id: group.id, name: group.name, permissions: { ...group.permissions } }
        : { id: null, name: '', permissions: uniformPermissions('none') },
    });
  }

  protected closeDrawer(): void {
    if (!this.saving()) this.drawer.set(null);
  }

  /** Changer de carte de rôle. Passer à « Sur mesure » part des droits du rôle quitté. */
  protected chooseRole(key: string): void {
    if (key === 'custom') {
      const previous = this.roleOption()?.permissions;
      if (previous) this.custom.set({ ...previous });
    }
    this.roleKey.set(key);
    this.error.set(null);
  }

  // ─── Inviter ──────────────────────────────────────────────────────────────

  protected onEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  protected nextStep(event?: Event): void {
    event?.preventDefault();
    if (!this.emailValid()) {
      this.error.set('invalid_email');
      return;
    }
    this.error.set(null);
    this.inviteStep.set(2);
  }

  protected sendInvite(): void {
    const option = this.roleOption();
    if (!option || !this.roleReady() || this.saving()) return;
    const email = this.email().trim();
    this.saving.set(true);
    this.error.set(null);
    this.teamService.invite(this.projectId(), email, roleInputOf(option, this.custom())).subscribe({
      next: (team) => {
        this.done(team);
        this.tab.set('members');
        this.notifications.showSuccess({
          title: this.translate.instant('team.invite.sentTitle'),
          message: this.translate.instant('team.invite.sentBody', { email }),
        });
      },
      error: (error) => {
        this.fail(error);
        // Une erreur d'adresse se corrige à l'étape de l'adresse.
        const code = TeamService.errorCode(error);
        if (['no_account', 'invalid_email', 'self_invite', 'already_member', 'already_invited'].includes(code)) {
          this.inviteStep.set(1);
        }
      },
    });
  }

  // ─── Une personne ────────────────────────────────────────────────────────

  protected saveMember(member: ProjectMemberView): void {
    const option = this.roleOption();
    if (!option || !this.roleReady() || this.saving()) return;
    this.saving.set(true);
    this.teamService.updateMember(this.projectId(), member.id, roleInputOf(option, this.custom())).subscribe({
      next: (team) => {
        this.done(team);
        this.notifications.showSuccess({
          title: this.translate.instant('team.members.savedTitle'),
          message: this.translate.instant('team.members.savedBody'),
        });
      },
      error: (error) => this.fail(error),
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
        this.done(team);
        this.toRemove.set(null);
      },
      error: (error) => {
        this.busyMemberId.set(null);
        this.notifications.showError({ title: this.translate.instant('team.errors.title'), message: this.errorText(TeamService.errorCode(error)) });
      },
    });
  }

  // ─── Groupes ──────────────────────────────────────────────────────────────

  protected onGroupName(draft: GroupDraft, event: Event): void {
    this.drawer.set({ kind: 'group', draft: { ...draft, name: (event.target as HTMLInputElement).value } });
    this.error.set(null);
  }

  protected onGroupPermissions(draft: GroupDraft, permissions: ProjectPermissions): void {
    this.drawer.set({ kind: 'group', draft: { ...draft, permissions } });
    this.error.set(null);
  }

  protected saveGroup(draft: GroupDraft): void {
    if (this.saving()) return;
    if (!draft.name.trim()) return this.error.set('invalid_name');
    if (!hasAnySpace(draft.permissions)) return this.error.set('empty_permissions');
    this.saving.set(true);
    const request = draft.id
      ? this.teamService.updateGroup(this.projectId(), draft.id, { name: draft.name.trim(), permissions: draft.permissions })
      : this.teamService.createGroup(this.projectId(), draft.name.trim(), draft.permissions);
    request.subscribe({
      next: (team) => this.done(team),
      error: (error) => this.fail(error),
    });
  }

  protected confirmDeleteGroup(): void {
    const group = this.toDeleteGroup();
    if (!group) return;
    this.saving.set(true);
    this.teamService.deleteGroup(this.projectId(), group.id).subscribe({
      next: (team) => {
        this.done(team);
        this.toDeleteGroup.set(null);
      },
      error: (error) => {
        this.saving.set(false);
        this.notifications.showError({ title: this.translate.instant('team.errors.title'), message: this.errorText(TeamService.errorCode(error)) });
      },
    });
  }
}
