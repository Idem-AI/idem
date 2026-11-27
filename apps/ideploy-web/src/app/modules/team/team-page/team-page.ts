import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { TeamInfo } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-team-page',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'team.title' | translate }}</h1>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <section class="glass-card p-4 mb-6">
      <h2 class="mb-3 font-semibold">{{ 'team.profile' | translate }}</h2>
      <form class="flex flex-col gap-2 sm:flex-row sm:flex-wrap" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
        <input type="text" class="sm:flex-1 sm:!w-auto min-w-0" [placeholder]="'team.namePlaceholder' | translate" formControlName="name" />
        <input type="text" class="sm:flex-1 sm:!w-auto min-w-0" [placeholder]="'team.descriptionPlaceholder' | translate" formControlName="description" />
        <button class="inner-button justify-center" type="submit" [disabled]="profileForm.invalid || savingProfile()">
          {{ (savingProfile() ? 'team.saving' : 'team.save') | translate }}
        </button>
      </form>
    </section>

    <section class="glass-card p-4 mb-6">
      <h2 class="mb-3 font-semibold">{{ 'team.members' | translate }}</h2>
      @for (m of members(); track m.user_id) {
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-sm" style="border-bottom:1px solid var(--color-surface-2);">
          <div class="min-w-0 flex-1 basis-48">
            <p class="truncate font-semibold">{{ m.name }}</p>
            <p class="truncate text-xs" style="color: var(--color-text-secondary)">{{ m.email }}</p>
          </div>
          <select class="!w-32 py-1 text-xs" [value]="m.role" [attr.aria-label]="m.name" (change)="changeRole(m, $event)">
            <option value="member">{{ 'team.roleMember' | translate }}</option>
            <option value="admin">{{ 'team.roleAdmin' | translate }}</option>
            <option value="owner">{{ 'team.roleOwner' | translate }}</option>
          </select>
          <button type="button" class="text-xs" style="color:var(--color-danger);" (click)="removeMember(m)">{{ 'team.remove' | translate }}</button>
        </div>
      }
    </section>

    <section class="glass-card p-4">
      <h2 class="mb-3 font-semibold">{{ 'team.invitations' | translate }}</h2>
      @for (inv of invitations(); track inv.uuid) {
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm" style="border-bottom:1px solid var(--color-surface-2);">
          <div class="min-w-0 flex-1 basis-48">
            <p class="truncate">{{ inv.email }} ({{ inv.role }})</p>
            <code class="block truncate text-xs" style="color: var(--color-text-secondary)">{{ inv.link }}</code>
          </div>
          <button type="button" class="text-xs" style="color:var(--color-danger);" (click)="revoke(inv.uuid)">{{ 'team.revoke' | translate }}</button>
        </div>
      }
      <form class="mt-3 flex flex-wrap gap-2" [formGroup]="form" (ngSubmit)="invite()">
        <input type="email" class="flex-1 basis-full sm:basis-48 !w-auto min-w-0" [placeholder]="'team.emailPlaceholder' | translate" formControlName="email" />
        <select class="flex-1 sm:flex-none sm:!w-32" formControlName="role">
          <option value="member">{{ 'team.roleMember' | translate }}</option>
          <option value="admin">{{ 'team.roleAdmin' | translate }}</option>
        </select>
        <button class="inner-button" type="submit" [disabled]="form.invalid">{{ 'team.invite' | translate }}</button>
      </form>
    </section>
  `,
})
export class TeamPageComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly members = signal<{ user_id: number; name: string; email: string; role: string }[]>([]);
  protected readonly invitations = signal<{ uuid: string; email: string; role: string; link: string }[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly savingProfile = signal(false);

  protected readonly profileForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['member', Validators.required],
  });

  ngOnInit(): void {
    this.load();
    this.api.getTeam().subscribe({
      next: (t: TeamInfo) => this.profileForm.patchValue({ name: t.name, description: t.description ?? '' }),
      error: (e) => this.report(e, 'team.loadError'),
    });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  private load(): void {
    this.api.listMembers().subscribe((m) => this.members.set(m));
    this.api.listInvitations().subscribe((i) => this.invitations.set(i));
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid) return;
    this.savingProfile.set(true);
    this.error.set(null);
    this.api.updateTeam(this.profileForm.getRawValue()).subscribe({
      next: () => this.savingProfile.set(false),
      error: (e) => {
        this.report(e, 'team.saveError');
        this.savingProfile.set(false);
      },
    });
  }

  protected changeRole(member: { user_id: number; role: string }, event: Event): void {
    const role = (event.target as HTMLSelectElement).value;
    this.api.setMemberRole(member.user_id, role).subscribe({
      next: () => (member.role = role),
      error: (e) => this.report(e, 'team.roleError'),
    });
  }

  protected removeMember(member: { user_id: number }): void {
    this.api.removeMember(member.user_id).subscribe({
      next: () => this.members.update((list) => list.filter((m) => m.user_id !== member.user_id)),
      error: (e) => this.report(e, 'team.removeError'),
    });
  }

  protected invite(): void {
    if (this.form.invalid) return;
    this.api.createInvitation(this.form.getRawValue()).subscribe(() => {
      this.form.reset({ email: '', role: 'member' });
      this.api.listInvitations().subscribe((i) => this.invitations.set(i));
    });
  }

  protected revoke(uuid: string): void {
    this.api.deleteInvitation(uuid).subscribe(() => {
      this.invitations.update((list) => list.filter((i) => i.uuid !== uuid));
    });
  }
}
