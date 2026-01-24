import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  Validators,
} from '@angular/forms';

// PrimNG Components
import { AccordionModule } from 'primeng/accordion';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { TfVarsFormData, TfVarFormSection, TfVarFormField } from '../../models/tfvars-parser.model';

@Component({
  selector: 'app-tfvars-form-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccordionModule,
    InputTextModule,
    TextareaModule,
    InputNumberModule,
    ToggleSwitchModule,
    ButtonModule,
    CardModule,
    FloatLabelModule,
    TagModule,
    TooltipModule,
    MessageModule,
  ],
  templateUrl: './tfvars-form-editor.html',
  styleUrl: './tfvars-form-editor.css',
})
export class TfVarsFormEditor implements OnInit {
  private readonly formBuilder = inject(FormBuilder);

  // Angular-specific properties
  @Input({ required: true }) set formData(value: TfVarsFormData | null) {
    if (value) {
      this.formDataSignal.set(value);
      this.buildForm();
    }
  }

  @Input() set readonly(value: boolean) {
    this.readonlySignal.set(value);
  }

  @Output() readonly formDataChanged = new EventEmitter<TfVarsFormData>();
  @Output() readonly addCustomField = new EventEmitter<void>();
  @Output() readonly removeField = new EventEmitter<{
    sectionName: string;
    fieldKey: string;
  }>();

  // Component state using signals
  protected readonly formDataSignal = signal<TfVarsFormData | null>(null);
  protected readonly readonlySignal = signal<boolean>(false);
  protected readonly mainForm = signal<FormGroup>(this.formBuilder.group({}));
  protected readonly expandedSections = signal<Set<string>>(new Set());
  protected readonly isAddingCustomField = signal<boolean>(false);
  protected readonly customFieldForm = signal<FormGroup>(this.createCustomFieldForm());

  // Computed properties
  protected readonly hasData = computed(() => {
    const data = this.formDataSignal();
    return data && data.sections.length > 0;
  });

  protected readonly sectionsWithData = computed(() => {
    const data = this.formDataSignal();
    return data?.sections.filter((section) => section.fields.length > 0) || [];
  });

  ngOnInit(): void {
    // Initialize with expanded first section
    const data = this.formDataSignal();
    if (data && data.sections.length > 0) {
      this.expandedSections.update((sections) => {
        sections.add(data.sections[0].name);
        return sections;
      });
    }
  }

  /**
   * Build reactive form from form data
   */
  protected buildForm(): void {
    const data = this.formDataSignal();
    if (!data) return;

    const formGroups: Record<string, FormGroup> = {};

    // Create form groups for each section
    for (const section of data.sections) {
      const sectionControls: Record<string, FormControl> = {};

      for (const field of section.fields) {
        const validators = this.buildValidators(field);
        sectionControls[field.key] = new FormControl(field.value, validators);
      }

      formGroups[section.name] = this.formBuilder.group(sectionControls);
    }

    // Create form group for custom fields
    if (data.customFields.length > 0) {
      const customControls: Record<string, FormControl> = {};
      for (const field of data.customFields) {
        const validators = this.buildValidators(field);
        customControls[field.key] = new FormControl(field.value, validators);
      }
      formGroups['custom'] = this.formBuilder.group(customControls);
    }

    const newForm = this.formBuilder.group(formGroups);
    this.mainForm.set(newForm);

    // Subscribe to form changes
    newForm.valueChanges.subscribe(() => {
      this.onFormChange();
    });
  }

  /**
   * Build validators for a field
   */
  protected buildValidators(field: TfVarFormField): any[] {
    const validators: any[] = [];

    if (field.required) {
      validators.push(Validators.required);
    }

    if (field.validation) {
      const validation = field.validation;

      if (validation.pattern) {
        validators.push(Validators.pattern(validation.pattern));
      }

      if (validation.min !== undefined) {
        validators.push(Validators.min(validation.min));
      }

      if (validation.max !== undefined) {
        validators.push(Validators.max(validation.max));
      }

      if (validation.minLength !== undefined) {
        validators.push(Validators.minLength(validation.minLength));
      }

      if (validation.maxLength !== undefined) {
        validators.push(Validators.maxLength(validation.maxLength));
      }
    }

    return validators;
  }

  /**
   * Handle form changes
   */
  protected onFormChange(): void {
    const form = this.mainForm();
    const data = this.formDataSignal();

    if (!form || !data) return;

    // Update form data with current form values
    const updatedData: TfVarsFormData = {
      sections: data.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => ({
          ...field,
          value: form.get(`${section.name}.${field.key}`)?.value || field.value,
        })),
      })),
      customFields: data.customFields.map((field) => ({
        ...field,
        value: form.get(`custom.${field.key}`)?.value || field.value,
      })),
    };

    this.formDataSignal.set(updatedData);
    this.formDataChanged.emit(updatedData);
  }

  /**
   * Toggle section expansion
   */
  protected toggleSection(sectionName: string): void {
    this.expandedSections.update((sections) => {
      if (sections.has(sectionName)) {
        sections.delete(sectionName);
      } else {
        sections.add(sectionName);
      }
      return sections;
    });
  }

  /**
   * Check if section is expanded
   */
  protected isSectionExpanded(sectionName: string): boolean {
    return this.expandedSections().has(sectionName);
  }

  /**
   * Get form control for a field
   */
  protected getFieldControl(sectionName: string, fieldKey: string): FormControl | null {
    const form = this.mainForm();
    return (form.get(`${sectionName}.${fieldKey}`) as FormControl) || null;
  }

  /**
   * Update array item at specific index
   */
  protected updateArrayItem(
    sectionName: string,
    fieldKey: string,
    index: number,
    value: string,
  ): void {
    const control = this.getFieldControl(sectionName, fieldKey);
    if (control && Array.isArray(control.value)) {
      const newArray = [...control.value];
      newArray[index] = value;
      control.setValue(newArray);

      // Emit updated form data using the same pattern as existing methods
      const form = this.mainForm();
      const data = this.formDataSignal();
      if (!form || !data) return;

      const updatedData: TfVarsFormData = {
        sections: data.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => ({
            ...field,
            value: form.get(`${section.name}.${field.key}`)?.value || field.value,
          })),
        })),
        customFields: data.customFields.map((field) => ({
          ...field,
          value: form.get(`custom.${field.key}`)?.value || field.value,
        })),
      };

      this.formDataSignal.set(updatedData);
      this.formDataChanged.emit(updatedData);
    }
  }

  /**
   * Get field error message
   */
  protected getFieldError(sectionName: string, fieldKey: string): string | null {
    const control = this.getFieldControl(sectionName, fieldKey);

    if (!control || !control.errors || !control.touched) {
      return null;
    }

    const errors = control.errors;

    if (errors['required']) {
      return 'This field is required';
    }

    if (errors['jsonInvalid']) {
      return 'Invalid JSON format';
    }

    if (errors['pattern']) {
      return 'Invalid format';
    }

    if (errors['min']) {
      return `Value must be at least ${errors['min'].min}`;
    }

    if (errors['max']) {
      return `Value must be at most ${errors['max'].max}`;
    }

    if (errors['minlength']) {
      return `Minimum length is ${errors['minlength'].requiredLength}`;
    }

    if (errors['maxlength']) {
      return `Maximum length is ${errors['maxlength'].requiredLength}`;
    }

    return 'Invalid value';
  }

  /**
   * Start adding custom field
   */
  protected startAddingCustomField(): void {
    this.isAddingCustomField.set(true);
    this.customFieldForm.set(this.createCustomFieldForm());
  }

  /**
   * Cancel adding custom field
   */
  protected cancelAddingCustomField(): void {
    this.isAddingCustomField.set(false);
  }

  /**
   * Save custom field
   */
  protected saveCustomField(): void {
    const form = this.customFieldForm();

    if (form.valid) {
      const formValue = form.value;
      const newField: TfVarFormField = {
        key: formValue.key,
        label: formValue.label || this.formatLabel(formValue.key),
        type: formValue.type,
        value: this.getDefaultValueForType(formValue.type),
        required: formValue.required || false,
        description: formValue.description || '',
      };

      // Add to custom fields
      const data = this.formDataSignal();
      if (data) {
        const updatedData: TfVarsFormData = {
          ...data,
          customFields: [...data.customFields, newField],
        };

        this.formDataSignal.set(updatedData);
        this.buildForm(); // Rebuild form to include new field
        this.formDataChanged.emit(updatedData);
      }

      this.isAddingCustomField.set(false);
    }
  }

  /**
   * Remove field from section
   */
  protected removeFieldFromSection(sectionName: string, fieldKey: string): void {
    const data = this.formDataSignal();
    if (!data) return;

    const updatedData: TfVarsFormData = {
      sections: data.sections.map((section) =>
        section.name === sectionName
          ? {
              ...section,
              fields: section.fields.filter((field) => field.key !== fieldKey),
            }
          : section,
      ),
      customFields:
        sectionName === 'custom'
          ? data.customFields.filter((field) => field.key !== fieldKey)
          : data.customFields,
    };

    this.formDataSignal.set(updatedData);
    this.buildForm(); // Rebuild form
    this.formDataChanged.emit(updatedData);
    this.removeField.emit({ sectionName, fieldKey });
  }

  /**
   * Create custom field form
   */
  protected createCustomFieldForm(): FormGroup {
    return this.formBuilder.group({
      key: ['', [Validators.required, Validators.pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/)]],
      label: [''],
      type: ['text', Validators.required],
      description: [''],
      required: [false],
    });
  }

  /**
   * Format label from key
   */
  protected formatLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Get default value for field type
   */
  protected getDefaultValueForType(type: TfVarFormField['type']): any {
    switch (type) {
      case 'text':
      case 'textarea':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return '';
    }
  }

  /**
   * Handle array field changes
   */
  protected onArrayFieldChange(sectionName: string, fieldKey: string, newValue: string[]): void {
    const control = this.getFieldControl(sectionName, fieldKey);
    if (control) {
      control.setValue(newValue);
    }
  }

  /**
   * Handle input changes for object fields from textarea.
   * This method parses the string input into a JSON object.
   */
  protected onObjectInputChange(sectionName: string, fieldKey: string, value: string): void {
    const control = this.getFieldControl(sectionName, fieldKey);
    if (!control) return;

    try {
      const parsedValue = value ? JSON.parse(value) : null;
      // Clear custom error if parsing is successful
      if (control.hasError('jsonInvalid')) {
        const { jsonInvalid, ...errors } = control.errors || {};
        control.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
      this.onObjectFieldChange(sectionName, fieldKey, parsedValue);
    } catch (e) {
      // Set a custom error on the form control for invalid JSON
      control.setErrors({ ...control.errors, jsonInvalid: true });
    }
  }

  /**
   * Handle object field changes
   */
  protected onObjectFieldChange(
    sectionName: string,
    fieldKey: string,
    newValue: Record<string, any> | null,
  ): void {
    const control = this.getFieldControl(sectionName, fieldKey);
    if (control) {
      // Set value without emitting an event to avoid cycles if onFormChange is subscribed
      control.setValue(newValue, { emitEvent: false });
      // Manually trigger the update and emission
      this.onFormChange();
    }
  }

  /**
   * Add item to array field
   */
  protected addArrayItem(sectionName: string, fieldKey: string): void {
    const control = this.getFieldControl(sectionName, fieldKey);
    if (control) {
      const currentValue = control.value || [];
      control.setValue([...currentValue, '']);
    }
  }

  /**
   * Remove item from array field
   */
  protected removeArrayItem(sectionName: string, fieldKey: string, index: number): void {
    const control = this.getFieldControl(sectionName, fieldKey);
    if (control) {
      const currentValue = control.value || [];
      const newValue = currentValue.filter((_: any, i: number) => i !== index);
      control.setValue(newValue);
    }
  }

  /**
   * Track array items for ngFor
   */
  protected trackArrayItem(index: number, item: any): any {
    return index;
  }

  /**
   * Track sections for ngFor
   */
  protected trackSection(index: number, section: TfVarFormSection): string {
    return section.name;
  }

  /**
   * Track fields for ngFor
   */
  protected trackField(index: number, field: TfVarFormField): string {
    return field.key;
  }
}
