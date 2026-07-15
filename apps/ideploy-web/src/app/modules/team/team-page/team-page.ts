import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-team-page',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'team.title' | translate }}</h1>

    <section class="box mb-6">
      <h2 class="mb-3 font-semibold">{{ 'team.members' | translate }}</h2>
      @for (m of members(); track m.user_id) {
        <div class="mb-1 flex items-center gap-3 text-sm">
          <span class="font-semibold">{{ m.name }}</span>
          <span style="color: var(--color-text-secondary)">{{ m.email }}</span>
          <span class="ml-auto">{{ m.role }}</span>
        </div>
      }
    </section>

    <section class="box">
      <h2 class="mb-3 font-semibold">{{ 'team.invitations' | translate }}</h2>
      @for (inv of invitations(); track inv.uuid) {
        <div class="mb-1 flex items-center gap-3 text-sm">
          <span>{{ inv.email }} ({{ inv.role }})</span>
          <code class="text-xs">{{ inv.link }}</code>
          <button class="ml-auto text-xs text-red-400" (click)="revoke(inv.uuid)">{{ 'team.revoke' | translate }}</button>
        </div>
      }
      <form class="mt-3 flex gap-2" [formGroup]="form" (ngSubmit)="invite()">
        <input class="input flex-1" [placeholder]="'team.emailPlaceholder' | translate" formControlName="email" />
        <select class="input w-32" formControlName="role">
          <option value="member">{{ 'team.roleMember' | translate }}</option>
          <option value="admin">{{ 'team.roleAdmin' | translate }}</option>
        </select>
        <button class="button" type="submit" [disabled]="form.invalid">{{ 'team.invite' | translate }}</button>
      </form>
    </section>
  `,
})
export class TeamPageComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  protected readonly members = signal<{ user_id: number; name: string; email: string; role: string }[]>([]);
  protected readonly invitations = signal<{ uuid: string; email: string; role: string; link: string }[]>([]);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['member', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listMembers().subscribe((m) => this.members.set(m));
    this.api.listInvitations().subscribe((i) => this.invitations.set(i));
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
