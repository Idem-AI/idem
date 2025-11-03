import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TechCardComponent, TechCardModel } from '../shared/tech-card';

@Component({
  selector: 'app-frontend-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    ToggleSwitchModule,
    TechCardComponent,
  ],
  templateUrl: './frontend-config.html',
  styleUrls: ['./frontend-config.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrontendConfigComponent {
  // Input properties
  readonly frontendForm = input.required<FormGroup>();
  readonly versionOptions = input.required<{
    [key: string]: { [key: string]: string[] };
  }>();
  readonly showAdvancedOptions = input.required<boolean>();
  readonly selectedStylingPreferences = input.required<string[]>();

  // Output events
  @Output() readonly stylingPreferencesChange = new EventEmitter<string[]>();

  // State signals
  protected readonly advancedOptionsVisibleFor = signal<string | null>(null);

  // State signals

  /**
   * Available frontend frameworks
   */
  protected readonly frontendFrameworks: TechCardModel[] = [
    {
      id: 'angular',
      name: 'Angular',
      icon: 'https://angular.dev/assets/images/press-kit/angular_icon_gradient.gif',
      color: '#DD0031',
      description: 'Powerful framework with reactive programming',
      badges: ['TypeScript', 'RxJS', 'Standalone Components'],
      versions: ['latest', '19.x', '18.x', '17.x', '16.x', '15.x'],
      isAvailable: true,
    },
    {
      id: 'react',
      name: 'React',
      icon: 'https://icon.icepanel.io/Technology/svg/React.svg',
      color: '#61DAFB',
      description: 'Modern React with hooks and context API',
      badges: ['JSX', 'Virtual DOM', 'Component-Based'],
      versions: ['latest', '19.x', '18.x', '17.x'],
      isAvailable: true,
    },
    {
      id: 'nextjs',
      name: 'Next.js',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg',
      color: '#000000',
      description: 'Full-stack React framework with SSR/SSG',
      badges: ['App Router', 'API Routes', 'ISR'],
      versions: ['latest', '14.x', '13.x', '12.x'],
      isAvailable: true,
    },
    {
      id: 'vue',
      name: 'Vue.js',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg',
      color: '#42b883',
      description: 'Progressive framework with intuitive API',
      badges: ['Composition API', 'SFCs', 'Pinia'],
      versions: ['latest', '3.x', '2.x'],
      isAvailable: true,
    },
    {
      id: 'svelte',
      name: 'Svelte',
      icon: 'https://icon.icepanel.io/Technology/svg/Svelte.svg',
      color: '#FF3E00',
      description: 'Compiled framework with minimal runtime',
      badges: ['No Virtual DOM', 'Reactive', 'SvelteKit'],
      versions: ['latest', '4.x', '3.x'],
      isAvailable: true,
    },
    {
      id: 'astro',
      name: 'Astro',
      icon: 'https://icon.icepanel.io/Technology/png-shadow-512/Astro.png',
      color: 'white',
      description: 'Content-focused static site generator',
      badges: ['Island Architecture', 'MPA', 'Zero JS by default'],
      versions: ['latest', '4.x', '3.x', '2.x'],
      isAvailable: false,
    },
  ];

  protected readonly frameworkUiLibraries: { [key: string]: TechCardModel[] } = {
    angular: [
      {
        id: 'angularMaterial',
        name: 'Angular Material',
        icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6CY5okaihNPZJIw5tK0cCZd1JaiSsmcSRAA&s',
        color: '#3F51B5',
        description: 'Official Material Design components for Angular',
        badges: ['Material Design', 'Accessibility', 'Theming'],
        versions: ['latest', '17.x', '16.x', '15.x'],
        isAvailable: true,
      },
      {
        id: 'primeNg',
        name: 'PrimeNG',
        icon: 'https://primefaces.org/cdn/primeng/images/logo.svg',
        color: '#007ad9',
        description: 'Rich UI components for Angular applications',
        badges: ['Rich Components', 'Themes', 'Data Tables'],
        versions: ['latest', '17.x', '16.x', '15.x'],
        isAvailable: true,
      },
      {
        id: 'ngBootstrap',
        name: 'ng-bootstrap',
        icon: 'https://ng-bootstrap.github.io/img/logo-stack.svg',
        color: '#7952B3',
        description: 'Bootstrap components for Angular',
        badges: ['Bootstrap', 'Responsive', 'Widgets'],
        versions: ['latest', '16.x', '15.x', '14.x'],
        isAvailable: true,
      },
      {
        id: 'antDesignAngular',
        name: 'Ant Design Angular',
        icon: 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
        color: '#1890ff',
        description: 'Enterprise UI components for Angular',
        badges: ['Enterprise', 'Design Language', 'TypeScript'],
        versions: ['latest', '17.x', '16.x', '15.x'],
        isAvailable: false,
      },
    ],

    // React specific UI libraries
    react: [
      {
        id: 'materialUi',
        name: 'Material-UI',
        icon: 'https://mui.com/static/logo.png',
        color: '#007FFF',
        description: 'React components implementing Material Design',
        badges: ['Material Design', 'Customizable', 'Accessibility'],
        versions: ['latest', '5.x', '4.x'],
        isAvailable: true,
      },
      {
        id: 'antDesignReact',
        name: 'Ant Design React',
        icon: 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
        color: '#1890ff',
        description: 'Enterprise UI components for React',
        badges: ['Enterprise', 'Design Language', 'Rich Components'],
        versions: ['latest', '5.x', '4.x'],
        isAvailable: false,
      },
      {
        id: 'chakraUi',
        name: 'Chakra UI',
        icon: 'https://img.logoipsum.com/243.svg',
        color: '#319795',
        description: 'Modular and accessible component library',
        badges: ['Modular', 'Accessible', 'Dark Mode'],
        versions: ['latest', '2.x', '1.x'],
        isAvailable: false,
      },
      {
        id: 'reactBootstrap',
        name: 'React Bootstrap',
        icon: 'https://react-bootstrap.github.io/img/logo.svg',
        color: '#7952B3',
        description: 'Bootstrap components for React',
        badges: ['Bootstrap', 'Responsive', 'Familiar API'],
        versions: ['latest', '2.x', '1.x'],
        isAvailable: true,
      },
    ],

    // Vue specific UI libraries
    vue: [
      {
        id: 'vuetify',
        name: 'Vuetify',
        icon: 'https://cdn.vuetifyjs.com/docs/images/logos/vuetify-logo-dark.svg',
        color: '#1867C0',
        description: 'Material Design component framework for Vue',
        badges: ['Material Design', 'Vue 3', 'Responsive'],
        versions: ['latest', '3.x', '2.x'],
        isAvailable: false,
      },
      {
        id: 'quasar',
        name: 'Quasar',
        icon: 'https://cdn.quasar.dev/logo-v2/svg/logo.svg',
        color: '#1976D2',
        description: 'High-performance Vue.js framework',
        badges: ['Cross-platform', 'Performance', 'CLI'],
        versions: ['latest', '2.x', '1.x'],
        isAvailable: false,
      },
      {
        id: 'elementPlus',
        name: 'Element Plus',
        icon: 'https://element-plus.org/images/element-plus-logo.svg',
        color: '#409EFF',
        description: 'Desktop UI library for Vue 3',
        badges: ['Vue 3', 'Desktop', 'TypeScript'],
        versions: ['latest', '2.x'],
        isAvailable: false,
      },
      {
        id: 'antDesignVue',
        name: 'Ant Design Vue',
        icon: 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
        color: '#1890ff',
        description: 'Enterprise UI components for Vue',
        badges: ['Enterprise', 'Design Language', 'Vue 3'],
        versions: ['latest', '4.x', '3.x'],
        isAvailable: false,
      },
    ],
    svelte: [
      {
        id: 'svelteUi',
        name: 'Svelte UI',
        icon: 'https://madewithsvelte.com/mandant/madewithsvelte/images/logo.png',
        color: '#FF3E00',
        description: 'Material UI components for Svelte',
        badges: ['Material UI', 'Lightweight', 'Fast'],
        versions: ['latest', '7.x', '6.x'],
        isAvailable: false,
      },
    ],
  };

  /**
   * Common styling options available for all frameworks
   */
  protected readonly commonStylingOptions: TechCardModel[] = [
    {
      id: 'tailwind',
      name: 'Tailwind CSS',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg',
      color: '#06B6D4',
      description: 'Utility-first CSS framework',
      badges: ['Utility-first', 'Responsive', 'Customizable'],
      versions: ['latest', '3.x', '2.x'],
      isAvailable: true,
    },
    {
      id: 'scss',
      name: 'SCSS',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sass/sass-original.svg',
      color: '#CF649A',
      description: 'CSS with superpowers',
      badges: ['Variables', 'Mixins', 'Nesting'],
      versions: ['latest', '3.x', '2.x'],
      isAvailable: true,
    },
    {
      id: 'bootstrap',
      name: 'Bootstrap',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bootstrap/bootstrap-original.svg',
      color: '#7952B3',
      description: 'Responsive component library',
      badges: ['Components', 'Grid System', 'Responsive'],
      versions: ['latest', '5.x', '4.x'],
      isAvailable: true,
    },
    {
      id: 'unocss',
      name: 'UnoCSS',
      icon: 'https://unocss.dev/logo.svg',
      color: '#333333',
      description: 'Instant on-demand atomic CSS engine',
      badges: ['Atomic', 'On-demand', 'Fast'],
      versions: ['latest', '3.x', '2.x'],
      isAvailable: false,
    },
  ];

  /**
   * Get available styling options based on selected framework
   */
  protected get stylingOptions() {
    const selectedFramework = this.frontendForm()?.get('framework')?.value;
    const frameworkSpecificOptions = selectedFramework
      ? this.frameworkUiLibraries[selectedFramework] || []
      : [];

    return [...this.commonStylingOptions, ...frameworkSpecificOptions];
  }

  /**
   * Toggle a styling preference in multi-select mode
   */
  protected toggleStylingPreference(styleName: string): void {
    const currentStyles = [...this.selectedStylingPreferences()];
    const index = currentStyles.indexOf(styleName);

    if (index === -1) {
      currentStyles.push(styleName);
    } else {
      currentStyles.splice(index, 1);
    }

    this.stylingPreferencesChange.emit(currentStyles);
    this.frontendForm().get('styling')?.setValue(currentStyles);
  }

  /**
   * Selects a framework and sets its icon URL in the form
   * @param frameworkId The ID of the selected framework
   * @param iconUrl The icon URL of the selected framework
   */
  selectFramework(frameworkId: string, iconUrl: string): void {
    this.frontendForm()!.get('framework')?.setValue(frameworkId);
    this.frontendForm()!.get('frameworkIconUrl')?.setValue(iconUrl);
  }

  /**
   * Toggle advanced options visibility for the specified framework
   */
  protected toggleAdvancedOptions(frameworkId: string): void {
    this.advancedOptionsVisibleFor.update((current) =>
      current === frameworkId ? null : frameworkId,
    );
  }

  /**
   * Check if advanced options are visible for a specific framework
   */
  protected isAdvancedOptionsVisible(frameworkId: string): boolean {
    return this.advancedOptionsVisibleFor() === frameworkId;
  }

  /**
   * Check if a styling preference is selected
   */
  protected isStylingSelected(style: string): boolean {
    return this.selectedStylingPreferences().includes(style);
  }

  /**
   * Frontend Features configuration list
   */
  protected readonly frontendFeatures = [
    {
      id: 'routing',
      name: 'Routing',
      description: 'Navigation management',
      icon: 'pi pi-compass',
      formControlName: 'features.routing',
    },
    {
      id: 'componentLibrary',
      name: 'Component Library',
      description: 'Pre-built UI components',
      icon: 'pi pi-box',
      formControlName: 'features.componentLibrary',
    },
    {
      id: 'testing',
      name: 'Testing',
      description: 'Unit & component tests',
      icon: 'pi pi-check-square',
      formControlName: 'features.testing',
    },
    {
      id: 'pwa',
      name: 'PWA',
      description: 'Progressive Web App',
      icon: 'pi pi-mobile',
      formControlName: 'features.pwa',
    },
    {
      id: 'seo',
      name: 'SEO',
      description: 'Search engine optimization',
      icon: 'pi pi-search',
      formControlName: 'features.seo',
    },
    {
      id: 'i18n',
      name: 'Internationalization',
      description: 'Multi-language support',
      icon: 'pi pi-globe',
      formControlName: 'features.i18n',
    },
  ];

  /**
   * Toggle a frontend feature
   */
  protected toggleFeature(formControlName: string): void {
    const control = this.frontendForm().get(formControlName);
    if (control) {
      control.setValue(!control.value);
    }
  }

  /**
   * Get feature value from form
   */
  protected getFeatureValue(formControlName: string): boolean {
    return this.frontendForm().get(formControlName)?.value || false;
  }

  /**
   * Toggle styling preference with ToggleSwitch
   */
  protected toggleStylingWithSwitch(styleName: string, event: any): void {
    const currentStyles = [...this.selectedStylingPreferences()];
    const index = currentStyles.indexOf(styleName);

    if (event.checked && index === -1) {
      currentStyles.push(styleName);
    } else if (!event.checked && index !== -1) {
      currentStyles.splice(index, 1);
    }

    this.stylingPreferencesChange.emit(currentStyles);
    this.frontendForm().get('styling')?.setValue(currentStyles);
  }

  /**
   * Get versions for the selected framework
   */
  protected getFrameworkVersions(): string[] {
    const selectedFramework = this.frontendForm().get('framework')?.value;
    // Handle nested structure of versionOptions
    if (selectedFramework && this.versionOptions()![selectedFramework]) {
      // Get versions from the first category key or return default
      const categories = Object.keys(this.versionOptions()[selectedFramework]);
      if (categories.length > 0) {
        return this.versionOptions()[selectedFramework][categories[0]] || ['latest'];
      }
    }
    return ['latest'];
  }
}
