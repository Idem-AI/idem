import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ProjectModel, ProjectTeamMember } from '@idem/shared-models';
import { CookieService } from '../../../../../../shared/services/cookie.service';
import { ProjectService } from '../../../../services/project.service';

/**
 * Étape 2 du business plan : les coordonnées et l'équipe.
 *
 * Deux partis pris, après les défauts constatés sur la version précédente :
 *
 * 1. Le bouton de validation ne se verrouille jamais. Un bouton gris qui ne
 *    réagit pas n'apprend rien : ici on clique toujours, et si une information
 *    manque le formulaire le dit, ouvre le bon membre et met le curseur dans le
 *    premier champ fautif. (L'ancien `computed` lisait `form.valid`, qui n'est
 *    pas un signal : il gelait sa valeur au premier calcul et la soumission
 *    restait refusée même une fois le formulaire complété.)
 *
 * 2. L'équipe est facultative, et un membre ajouté se referme en une ligne.
 *    Exiger quatre champs par personne — dont une biographie — sur une carte
 *    qu'on ne pouvait plus supprimer bloquait l'étape entière.
 */
@Component({
  selector: 'app-additional-info-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent],
  templateUrl: './additional-info-form.html',
  styleUrl: './additional-info-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdditionalInfoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // Outputs
  readonly formSubmitted = output<ProjectModel['additionalInfos']>();
  readonly formCancelled = output<void>();

  // État de l'écran
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly projectId = signal<string | null>(null);
  protected readonly uploadingMembers = signal<ReadonlySet<number>>(new Set());

  /** Une tentative de validation a eu lieu : les champs vides se signalent
      désormais même sans avoir été visités. */
  protected readonly submitAttempted = signal(false);

  /** Le membre ouvert en édition. Un seul à la fois : la liste reste lisible. */
  protected readonly openMember = signal<number | null>(null);

  /** Les membres dont les liens sociaux sont dépliés. Repliés par défaut :
      trois champs par personne qu'on remplit rarement. */
  protected readonly socialOpen = signal<ReadonlySet<number>>(new Set());

  /** Les FormGroup de l'équipe, en signal : avec OnPush, le template doit être
      prévenu quand on ajoute ou retire un membre. */
  protected readonly members = signal<FormGroup[]>([]);

  /**
   * Compteur incrémenté à chaque changement de valeur ou d'état du formulaire.
   * C'est lui — et non `form.valid` — qui rend la validité observable par les
   * signaux et déclenche la détection de changements.
   */
  private readonly formRevision = signal(0);

  protected readonly additionalInfoForm: FormGroup;

  /** Nombre de champs encore fautifs, pour le message de pied de page. */
  protected readonly missingCount = computed(() => {
    this.formRevision();
    return this.countInvalidControls(this.additionalInfoForm);
  });

  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  constructor() {
    this.additionalInfoForm = this.createForm();

    // Les deux flux sont émis après que `updateValueAndValidity` a recalculé
    // l'état : ce qu'on lit ensuite est à jour. `valueChanges` couvre la
    // saisie, `statusChanges` les ajouts et retraits de membres, qui changent
    // la validité sans toucher aux valeurs déjà saisies.
    this.additionalInfoForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formRevision.update((v) => v + 1));
    this.additionalInfoForm.statusChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formRevision.update((v) => v + 1));
  }

  ngOnInit(): void {
    this.projectId.set(this.cookieService.get('projectId'));
    this.loadExistingData();
  }

  // ── Construction du formulaire ─────────────────────────────────────────────

  /**
   * Obligatoire : ce qui figure sur la page de garde et la fiche de contact.
   * Le code postal reste libre — une grande partie de nos pays n'en a pas, et
   * l'exiger bloquait l'étape pour rien.
   */
  private createForm(): FormGroup {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required]],
      city: ['', [Validators.required]],
      country: ['', [Validators.required]],
      zipCode: [''],
      teamMembers: this.fb.array([]),
    });
  }

  /**
   * Un membre vaut par son nom et son rôle : c'est ce que le lecteur cherche.
   * La biographie et l'e-mail enrichissent le document sans le conditionner.
   */
  private createTeamMemberForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      role: ['', [Validators.required]],
      email: ['', [Validators.email]],
      bio: [''],
      pictureUrl: [''],
      pictureFile: [null],
      socialLinks: this.fb.group({
        linkedin: [''],
        github: [''],
        twitter: [''],
      }),
    });
  }

  private get teamMembers(): FormArray {
    return this.additionalInfoForm.get('teamMembers') as FormArray;
  }

  /**
   * `FormArray.controls` est muté sur place : repasser la même référence au
   * signal ne notifierait personne (comparaison par identité) et la liste
   * resterait figée à l'écran. On en recopie donc le contenu.
   */
  private syncMembers(): void {
    this.members.set([...(this.teamMembers.controls as FormGroup[])]);
  }

  // ── Chargement ─────────────────────────────────────────────────────────────

  private async loadExistingData(): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;

    try {
      this.isLoading.set(true);
      const project = await this.projectService.getProjectById(projectId).toPromise();

      if (project?.additionalInfos) {
        this.populateForm(project.additionalInfos);
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      this.error.set(this.translate.instant('dashboard.additionalInfoForm.errors.loadData'));
    } finally {
      this.isLoading.set(false);
    }
  }

  private populateForm(additionalInfos: ProjectModel['additionalInfos']): void {
    if (!additionalInfos) return;

    this.additionalInfoForm.patchValue({
      email: additionalInfos.email || '',
      phone: additionalInfos.phone || '',
      address: additionalInfos.address || '',
      city: additionalInfos.city || '',
      country: additionalInfos.country || '',
      zipCode: additionalInfos.zipCode || '',
    });

    const teamMembers = this.teamMembers;
    teamMembers.clear();

    additionalInfos.teamMembers?.forEach((member: ProjectTeamMember) => {
      const memberForm = this.createTeamMemberForm();
      memberForm.patchValue({
        name: member.name,
        role: member.role,
        email: member.email,
        bio: member.bio,
        pictureUrl: member.pictureUrl || '',
        socialLinks: {
          linkedin: member.socialLinks?.linkedin || '',
          github: member.socialLinks?.github || '',
          twitter: member.socialLinks?.twitter || '',
        },
      });
      teamMembers.push(memberForm);
    });

    // Les membres déjà renseignés arrivent repliés : la liste se lit d'un coup
    // d'œil, on ouvre celui qu'on veut corriger.
    this.syncMembers();
    this.openMember.set(null);
  }

  // ── Équipe ─────────────────────────────────────────────────────────────────

  protected addTeamMember(): void {
    this.teamMembers.push(this.createTeamMemberForm());
    this.syncMembers();
    // Ajouté = ouvert, et le curseur part dans le champ du nom.
    const index = this.teamMembers.length - 1;
    this.openMember.set(index);
    this.focusLater(`#member-name-${index}`);
  }

  protected removeTeamMember(index: number): void {
    this.teamMembers.removeAt(index);
    this.syncMembers();

    // Les index glissent : on referme plutôt que d'ouvrir le mauvais membre.
    const open = this.openMember();
    if (open === index) this.openMember.set(null);
    else if (open !== null && open > index) this.openMember.set(open - 1);

    this.socialOpen.set(new Set());
  }

  protected toggleMember(index: number): void {
    this.openMember.update((current) => (current === index ? null : index));
  }

  protected toggleSocial(index: number): void {
    this.socialOpen.update((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  protected isSocialOpen(index: number): boolean {
    return this.socialOpen().has(index);
  }

  /** Le nom saisi, ou rien : le template retombe alors sur « Membre n ». */
  protected memberName(index: number): string {
    return (this.members()[index]?.get('name')?.value as string) || '';
  }

  protected memberRole(index: number): string {
    return (this.members()[index]?.get('role')?.value as string) || '';
  }

  protected memberPicture(index: number): string {
    return (this.members()[index]?.get('pictureUrl')?.value as string) || '';
  }

  /** Initiales pour l'avatar sans photo : plus parlant qu'une silhouette. */
  protected memberInitials(index: number): string {
    const name = this.memberName(index).trim();
    if (!name) return String(index + 1);
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  /** Signalé sur la ligne repliée : on voit où il manque quelque chose. */
  protected isMemberIncomplete(index: number): boolean {
    this.formRevision();
    return this.members()[index]?.invalid ?? false;
  }

  protected isUploadingMember(index: number): boolean {
    return this.uploadingMembers().has(index);
  }

  // ── Photo d'un membre ──────────────────────────────────────────────────────

  protected async onPictureSelected(event: Event, memberIndex: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // L'`input` est réinitialisé tout de suite : sans cela, rechoisir le même
    // fichier après l'avoir retiré ne déclenche aucun `change`.
    input.value = '';

    if (!file.type.startsWith('image/')) {
      this.error.set(this.translate.instant('dashboard.additionalInfoForm.errors.onlyImages'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.error.set(this.translate.instant('dashboard.additionalInfoForm.errors.fileSize'));
      return;
    }

    try {
      this.uploadingMembers.update((set) => new Set(set).add(memberIndex));
      const pictureUrl = await this.convertFileToDataUrl(file);

      this.members()[memberIndex]?.patchValue({ pictureUrl, pictureFile: file });
      this.error.set(null);
    } catch (error) {
      console.error('Error processing image:', error);
      this.error.set(this.translate.instant('dashboard.additionalInfoForm.errors.processImage'));
    } finally {
      this.uploadingMembers.update((set) => {
        const next = new Set(set);
        next.delete(memberIndex);
        return next;
      });
    }
  }

  protected removePicture(memberIndex: number): void {
    this.members()[memberIndex]?.patchValue({ pictureUrl: '', pictureFile: null });
  }

  private async convertFileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Un champ ne crie pas pendant qu'on le remplit : son message apparaît quand
   * on le quitte, ou dès qu'on a tenté de valider.
   */
  private messageFor(control: AbstractControl | null): string | null {
    if (!control || !control.errors) return null;
    if (!control.touched && !this.submitAttempted()) return null;

    if (control.errors['required'])
      return this.translate.instant('dashboard.additionalInfoForm.errors.required');
    if (control.errors['email'])
      return this.translate.instant('dashboard.additionalInfoForm.errors.email');
    return this.translate.instant('validation.invalid');
  }

  protected getFieldError(fieldPath: string): string | null {
    this.formRevision();
    return this.messageFor(this.additionalInfoForm.get(fieldPath));
  }

  protected getTeamMemberFieldError(memberIndex: number, fieldName: string): string | null {
    this.formRevision();
    return this.messageFor(this.members()[memberIndex]?.get(fieldName) ?? null);
  }

  private countInvalidControls(group: AbstractControl): number {
    if (group instanceof FormGroup) {
      return Object.values(group.controls).reduce(
        (total, child) => total + this.countInvalidControls(child),
        0,
      );
    }
    if (group instanceof FormArray) {
      return group.controls.reduce((total, child) => total + this.countInvalidControls(child), 0);
    }
    return group.invalid ? 1 : 0;
  }

  // ── Soumission ─────────────────────────────────────────────────────────────

  protected async submitForm(): Promise<void> {
    this.submitAttempted.set(true);

    if (!this.additionalInfoForm.valid) {
      this.additionalInfoForm.markAllAsTouched();
      this.formRevision.update((v) => v + 1);
      this.error.set(null);
      this.revealFirstProblem();
      return;
    }

    try {
      this.isSubmitting.set(true);
      this.error.set(null);

      const formValue = this.additionalInfoForm.value;

      // Le backend attend `position` là où le formulaire parle de `role`, et
      // `pictureFile` voyage à part pour l'envoi multipart.
      const cleanedTeamMembers = formValue.teamMembers.map((member: any) => ({
        name: member.name,
        position: member.role,
        email: member.email || '',
        bio: member.bio || '',
        pictureUrl: member.pictureUrl || '',
        pictureFile: member.pictureFile,
        socialLinks: {
          linkedin: member.socialLinks?.linkedin || '',
          github: member.socialLinks?.github || '',
          twitter: member.socialLinks?.twitter || '',
        },
      }));

      const additionalInfos: ProjectModel['additionalInfos'] = {
        email: formValue.email,
        phone: formValue.phone,
        address: formValue.address,
        city: formValue.city,
        country: formValue.country,
        zipCode: formValue.zipCode,
        teamMembers: cleanedTeamMembers,
      };

      this.formSubmitted.emit(additionalInfos);
    } catch (error) {
      console.error('Error submitting additional info:', error);
      this.error.set(this.translate.instant('dashboard.additionalInfoForm.errors.saveInfo'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected cancel(): void {
    this.formCancelled.emit();
  }

  /**
   * Ouvre le membre fautif s'il y en a un, puis amène le curseur sur le premier
   * champ en défaut. Sans cela, un champ manquant replié reste introuvable.
   */
  private revealFirstProblem(): void {
    const firstInvalidMember = this.members().findIndex((member) => member.invalid);
    if (firstInvalidMember !== -1 && this.additionalInfoForm.get('teamMembers')?.invalid) {
      // Les coordonnées passent d'abord : on n'ouvre un membre que si elles
      // sont complètes, sinon on renvoie l'utilisateur deux fois en arrière.
      const contactsValid = ['email', 'phone', 'address', 'city', 'country'].every(
        (name) => this.additionalInfoForm.get(name)?.valid,
      );
      if (contactsValid) this.openMember.set(firstInvalidMember);
    }

    this.focusLater('[aria-invalid="true"]');
  }

  /** Le champ visé peut n'exister qu'après le prochain rendu. */
  private focusLater(selector: string): void {
    setTimeout(() => {
      const target = this.host.nativeElement.querySelector<HTMLElement>(selector);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target.focus({ preventScroll: true });
    });
  }
}
