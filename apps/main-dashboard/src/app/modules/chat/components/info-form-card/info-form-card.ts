import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ChatSessionService } from '../../services/chat-session.service';
import { AdditionalInfos } from '../../services/chat-additional-info.service';

interface TeamMemberDraft {
  name: string;
  role: string;
  email: string;
  bio: string;
}

/**
 * Mini-formulaire affiché dans le fil de conversation pour saisir les
 * informations supplémentaires du business plan (contact + équipe),
 * sans quitter le chat. Pré-rempli depuis le projet si disponible.
 */
@Component({
  selector: 'app-info-form-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './info-form-card.html',
  styleUrl: './info-form-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoFormCardComponent implements OnInit {
  private readonly session = inject(ChatSessionService);

  /** Carte figée après envoi */
  readonly submitted = input<boolean>(false);
  readonly busy = input<boolean>(false);

  readonly infosSubmitted = output<AdditionalInfos>();
  readonly skipped = output<void>();

  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly city = signal('');
  protected readonly country = signal('');
  protected readonly address = signal('');
  protected readonly members = signal<TeamMemberDraft[]>([]);

  ngOnInit(): void {
    const existing = this.session.activeProject()?.additionalInfos;
    if (existing) {
      this.email.set(existing.email || '');
      this.phone.set(existing.phone || '');
      this.city.set(existing.city || '');
      this.country.set(existing.country || '');
      this.address.set(existing.address || '');
      this.members.set(
        (existing.teamMembers || []).map((m) => ({
          name: m.name || '',
          role: m.role || '',
          email: m.email || '',
          bio: m.bio || '',
        })),
      );
    }
    if (this.members().length === 0) {
      this.addMember();
    }
  }

  protected addMember(): void {
    this.members.update((list) => [...list, { name: '', role: '', email: '', bio: '' }]);
  }

  protected removeMember(index: number): void {
    this.members.update((list) => list.filter((_, i) => i !== index));
  }

  protected updateMember(index: number, field: keyof TeamMemberDraft, value: string): void {
    this.members.update((list) =>
      list.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  }

  protected submit(): void {
    if (this.submitted() || this.busy()) return;
    const teamMembers = this.members()
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        role: m.role.trim(),
        // Le backend business plan lit `position`
        position: m.role.trim(),
        email: m.email.trim(),
        bio: m.bio.trim(),
        socialLinks: {},
      }));
    this.infosSubmitted.emit({
      email: this.email().trim(),
      phone: this.phone().trim(),
      address: this.address().trim(),
      city: this.city().trim(),
      country: this.country().trim(),
      zipCode: '',
      teamMembers: teamMembers as AdditionalInfos['teamMembers'],
    });
  }
}
