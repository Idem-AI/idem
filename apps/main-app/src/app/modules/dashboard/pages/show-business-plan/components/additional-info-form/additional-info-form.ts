import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  output,
  signal,
  computed,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
// Note: Using InputTextModule for textarea (PrimeNG uses same module)
import { FileUploadModule } from 'primeng/fileupload';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TeamMember, ProjectModel } from '../../../../models/project.model';
import { ProjectService } from '../../../../services/project.service';
import { CookieService } from '../../../../../../shared/services/cookie.service';

@Component({
  selector: 'app-additional-info-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    FileUploadModule,
    CardModule,
    DividerModule,
    MessageModule,
    SkeletonModule,
  ],
  templateUrl: './additional-info-form.html',
  styleUrl: './additional-info-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdditionalInfoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);

  // Outputs
  readonly formSubmitted = output<ProjectModel['additionalInfos']>();
  readonly formCancelled = output<void>();

  // Signals
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly projectId = signal<string | null>(null);
  protected readonly uploadingMembers = signal<Set<number>>(new Set());

  // Form
  protected readonly additionalInfoForm: FormGroup;

  // Computed properties
  protected readonly isFormValid = computed(
    () => this.additionalInfoForm?.valid || false
  );
  protected readonly teamMembersArray = computed(
    () => this.additionalInfoForm?.get('teamMembers') as FormArray
  );

  constructor() {
    this.additionalInfoForm = this.createForm();
  }

  ngOnInit(): void {
    this.projectId.set(this.cookieService.get('projectId'));
    this.loadExistingData();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required]],
      city: ['', [Validators.required]],
      country: ['', [Validators.required]],
      zipCode: ['', [Validators.required]],
      teamMembers: this.fb.array([]), // Start with empty array
    });
  }

  private createTeamMemberForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required]],
      role: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      bio: ['', [Validators.required]],
      pictureUrl: [''],
      pictureFile: [null],
      socialLinks: this.fb.group({
        linkedin: [''],
        github: [''],
        twitter: [''],
      }),
    });
  }

  private async loadExistingData(): Promise<void> {
    const projectId = this.projectId();
    if (!projectId) return;

    try {
      this.isLoading.set(true);
      const project = await this.projectService
        .getProjectById(projectId)
        .toPromise();

      if (project?.additionalInfos) {
        this.populateForm(project.additionalInfos);
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      this.error.set('Error loading data');
    } finally {
      this.isLoading.set(false);
    }
  }

  private populateForm(additionalInfos: ProjectModel['additionalInfos']): void {
    // Populate basic info
    this.additionalInfoForm.patchValue({
      email: additionalInfos.email || '',
      phone: additionalInfos.phone || '',
      address: additionalInfos.address || '',
      city: additionalInfos.city || '',
      country: additionalInfos.country || '',
      zipCode: additionalInfos.zipCode || '',
    });

    // Populate team members
    const teamMembersArray = this.teamMembersArray();
    teamMembersArray.clear();

    if (additionalInfos.teamMembers?.length > 0) {
      additionalInfos.teamMembers.forEach((member: TeamMember) => {
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
        teamMembersArray.push(memberForm);
      });
    }
    // No else clause - keep team members array empty if no existing data
  }

  protected addTeamMember(): void {
    this.teamMembersArray().push(this.createTeamMemberForm());
  }

  protected removeTeamMember(index: number): void {
    this.teamMembersArray().removeAt(index);
  }

  protected async onFileSelect(event: any, memberIndex: number): Promise<void> {
    const file = event.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.error.set('Only image files are allowed');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('File size must not exceed 5MB');
      return;
    }

    try {
      this.uploadingMembers.update((set) => new Set(set.add(memberIndex)));
      const pictureUrl = await this.convertFileToDataUrl(file);

      // Update form with the image data URL and file
      const memberForm = this.teamMembersArray().at(memberIndex);
      memberForm.patchValue({
        pictureUrl,
        pictureFile: file,
      });

      this.error.set(null);
    } catch (error) {
      console.error('Error processing image:', error);
      this.error.set('Error processing image');
    } finally {
      this.uploadingMembers.update((set) => {
        const newSet = new Set(set);
        newSet.delete(memberIndex);
        return newSet;
      });
    }
  }

  private async convertFileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  protected isUploadingMember(index: number): boolean {
    return this.uploadingMembers().has(index);
  }

  protected async submitForm(): Promise<void> {
    if (!this.isFormValid()) return;

    try {
      this.isSubmitting.set(true);
      this.error.set(null);

      const formValue = this.additionalInfoForm.value;

      // Clean up team members data and preserve files
      const cleanedTeamMembers = formValue.teamMembers.map((member: any) => ({
        name: member.name,
        position: member.role, // Backend expects 'position' not 'role'
        email: member.email,
        bio: member.bio,
        pictureUrl: member.pictureUrl || '',
        pictureFile: member.pictureFile, // Keep the file for multipart upload
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

      // Emit the data for business plan generation (with files included)
      this.formSubmitted.emit(additionalInfos);
    } catch (error) {
      console.error('Error submitting additional info:', error);
      this.error.set('Error saving information');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected cancel(): void {
    this.formCancelled.emit();
  }

  protected getFieldError(fieldPath: string): string | null {
    const field = this.additionalInfoForm.get(fieldPath);
    if (!field || !field.errors || !field.touched) return null;

    if (field.errors['required']) return 'This field is required';
    if (field.errors['email']) return 'Invalid email';
    return 'Invalid field';
  }

  protected getTeamMemberFieldError(
    memberIndex: number,
    fieldName: string
  ): string | null {
    const field = this.teamMembersArray().at(memberIndex)?.get(fieldName);
    if (!field || !field.errors || !field.touched) return null;

    if (field.errors['required']) return 'This field is required';
    if (field.errors['email']) return 'Invalid email';
    return 'Invalid field';
  }
}
