# CLAUDE.md - Main App (Angular 20)

This file provides guidance to **Claude Code** when working with the **main-app** Angular 20 application.

## Project Overview

Main-app is the primary user interface for the Idem platform, built with **Angular 20** and **Tailwind CSS 4**. It serves as the central hub for architecture visualization, diagram generation, and platform management.

## Technology Stack

- **Framework**: Angular 20.0.0 (standalone components)
- **Styling**: Tailwind CSS 4.0.15
- **UI Components**: PrimeNG 20.1.1 with custom theming
- **State Management**: Angular Signals
- **HTTP Client**: Angular HttpClient with SSE support
- **Markdown**: ngx-markdown with syntax highlighting
- **PDF**: ngx-extended-pdf-viewer
- **AI Integration**: OpenAI, Google Generative AI
- **SSR**: Angular Universal (@angular/ssr)
- **Build Tool**: Angular CLI with Vite

## MCP Integration

**Use the Angular 20 MCP** for all Angular-specific queries and code generation.

The MCP provides:

- Angular 20 best practices
- Signals and reactivity patterns
- Standalone components guidance
- Dependency injection patterns
- Router and forms best practices

## Design System - CRITICAL

**ALL UI COMPONENTS MUST FOLLOW THE IDEM DESIGN SYSTEM**

**🚨 MANDATORY: This project uses Tailwind CSS 4.x and `@idem/shared-styles` package.**

### Shared Styles Integration

This project uses the **`@idem/shared-styles`** package for consistent design across all Idem applications.

**Import in your CSS:**

```css
@import '@idem/shared-styles/styles.css';
```

**Extend in tailwind.config:**

```typescript
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{html,ts}'],
};
```

### Theme Configuration

The design system is defined in `@idem/shared-styles/styles.css`. **ALWAYS** use this shared package.

#### Core Colors

```typescript
// Use these CSS variables in components
--color-primary: #1447e6
--color-secondary: #d11ec0
--color-accent: #22d3ee
--color-bg-dark: #06080d
--color-bg-light: #0f141b
--color-light-text: #f5f5f5
--color-success: #219653
--color-danger: #d34053
--color-warning: #ffa70b
```

#### Glass Morphism Effects

**ALWAYS use these classes for cards, modals, and containers:**

```html
<!-- Standard glass effect -->
<div class="glass rounded-2xl p-6">
  <!-- Content -->
</div>

<!-- Darker glass effect -->
<div class="glass-dark rounded-2xl p-6">
  <!-- Content -->
</div>

<!-- Glass card with hover effect -->
<div class="glass-card p-6">
  <!-- Content -->
</div>
```

#### Button Styles

```html
<!-- Primary gradient button -->
<button class="inner-button">Action Button</button>

<!-- Glass button with border -->
<button class="outer-button">Secondary Action</button>

<!-- Disabled state -->
<button class="inner-button" [disabled]="true">Disabled</button>
```

#### Form Elements

```html
<!-- Input field -->
<input type="text" class="input" placeholder="Enter text" />

<!-- With focus state (automatic) -->
<input type="text" class="input" [(ngModel)]="value" />
```

#### Glow Effects

```html
<!-- Primary glow -->
<div class="glow-primary rounded-xl p-4">
  <!-- Content -->
</div>

<!-- Text glow -->
<h1 class="text-glow-primary text-4xl">Glowing Title</h1>
```

### Tailwind CSS 4 Guidelines

**🚨 CRITICAL**: This project uses Tailwind CSS 4 ONLY. Never use Tailwind v3 syntax.

#### Import Syntax

```css
/* ✅ Correct (v4) - Import shared styles */
@import '@idem/shared-styles/styles.css';

/* ❌ NEVER USE (v3) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### Tailwind 4 Updated Syntax

| ❌ NEVER USE (v3)   | ✅ ALWAYS USE (v4)      |
| ------------------- | ----------------------- |
| `@tailwind base`    | `@import 'tailwindcss'` |
| `bg-opacity-50`     | `bg-black/50`           |
| `text-opacity-80`   | `text-white/80`         |
| `flex-shrink-0`     | `shrink-0`              |
| `flex-grow-1`       | `grow`                  |
| `overflow-ellipsis` | `text-ellipsis`         |
| `border-opacity-50` | `border-black/50`       |
| `divide-opacity-50` | `divide-black/50`       |
| `ring-opacity-50`   | `ring-black/50`         |

**Example:**

```html
<!-- ✅ Correct (v4) -->
<div class="bg-black/50 text-white/80 shrink-0">
  <!-- ❌ Wrong (v3) - DO NOT USE -->
  <div class="bg-opacity-50 text-opacity-80 flex-shrink-0"></div>
</div>
```

### PrimeNG Integration

PrimeNG components should be styled to match the dark glass theme:

```typescript
// In component
import { ButtonModule } from 'primeng/button';

// Template
<p-button
  label="Action"
  styleClass="inner-button"
  [style]="{'width': '100%'}"
></p-button>
```

**Custom PrimeNG Theme:**

- Use `@primeng/themes` with dark mode
- Override styles to match glass morphism
- Ensure consistent spacing and borders

## Angular 20 Best Practices

### Standalone Components

**ALWAYS use standalone components** (Angular 20 default):

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-component.html',
  styleUrls: ['./my-component.css'],
})
export class MyComponent {
  // Component logic
}
```

### Signals for State Management

**Use signals for reactive state:**

```typescript
import { Component, signal, computed, effect } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <div class="glass-card p-6">
      <h2 class="text-2xl mb-4">Count: {{ count() }}</h2>
      <p>Double: {{ doubled() }}</p>
      <button class="inner-button" (click)="increment()">Increment</button>
    </div>
  `,
})
export class Counter {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  constructor() {
    effect(() => {
      console.log('Count changed:', this.count());
    });
  }

  increment() {
    this.count.update((v) => v + 1);
  }
}
```

### Dependency Injection

**Use inject() function in Angular 20:**

```typescript
import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-data',
  standalone: true,
  template: `...`,
})
export class Data {
  private http = inject(HttpClient);
  private router = inject(Router);

  loadData() {
    this.http.get('/api/data').subscribe((data) => {
      // Handle data
    });
  }
}
```

### Routing

**Use functional route guards and resolvers:**

```typescript
// routes.ts
import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [() => inject(AuthService).isAuthenticated()],
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    canActivate: [() => inject(AuthService).isAdmin()],
  },
];
```

### Forms

**Use Reactive Forms with typed forms:**

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="userForm" (ngSubmit)="onSubmit()" class="glass-card p-6">
      <div class="mb-4">
        <label class="block text-sm mb-2">Name</label>
        <input type="text" formControlName="name" class="input" />
        @if (userForm.get('name')?.hasError('required') && userForm.get('name')?.touched) {
          <span class="text-red-500 text-sm">Name is required</span>
        }
      </div>

      <button type="submit" class="inner-button" [disabled]="userForm.invalid">Submit</button>
    </form>
  `,
})
export class UserForm {
  private fb = inject(FormBuilder);

  userForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit() {
    if (this.userForm.valid) {
      console.log(this.userForm.value);
    }
  }
}
```

### Control Flow Syntax

**Use new Angular 20 control flow:**

```html
<!-- ✅ Correct (Angular 20) -->
@if (isLoading()) {
<div class="glass p-4">Loading...</div>
} @else {
<div class="glass-card p-6">
  @for (item of items(); track item.id) {
  <div class="mb-2">{{ item.name }}</div>
  } @empty {
  <p>No items found</p>
  }
</div>
}

<!-- ❌ Old syntax (avoid) -->
<div *ngIf="isLoading">Loading...</div>
<div *ngFor="let item of items">{{ item.name }}</div>
```

## Project Structure

```
src/
├── app/
│   ├── components/        # Reusable components
│   ├── pages/            # Page components (routes)
│   ├── services/         # Injectable services
│   ├── guards/           # Route guards
│   ├── interceptors/     # HTTP interceptors
│   ├── models/           # TypeScript interfaces/types
│   ├── pipes/            # Custom pipes
│   └── app.routes.ts     # Application routes
├── assets/               # Static assets
├── styles.css            # Global styles + design system
└── index.html
```

## Code Organization

### Services

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private data = signal<any[]>([]);

  getData(): Observable<any[]> {
    return this.http.get<any[]>('/api/data');
  }

  setData(newData: any[]) {
    this.data.set(newData);
  }

  get currentData() {
    return this.data.asReadonly();
  }
}
```

### Interceptors

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
};
```

## Testing

### Component Testing

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should increment count', () => {
    component.increment();
    expect(component.count()).toBe(1);
  });
});
```

### Service Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DataService],
    });
    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch data', () => {
    const mockData = [{ id: 1, name: 'Test' }];

    service.getData().subscribe((data) => {
      expect(data).toEqual(mockData);
    });

    const req = httpMock.expectOne('/api/data');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });
});
```

## Performance Optimization

### Lazy Loading

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'feature',
    loadComponent: () => import('./feature/feature.component').then((m) => m.FeatureComponent),
  },
];
```

### OnPush Change Detection

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-optimized',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`,
})
export class Optimized {
  // Use signals for automatic change detection
}
```

### Track By Function

```html
@for (item of items(); track item.id) {
<div class="glass-card p-4 mb-2">{{ item.name }}</div>
}
```

## Development Commands

```bash
# Start development server
npm run dev
# or
npm start

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm test -- --code-coverage

# Serve SSR build
npm run serve:ssr:idem
```

## Common Patterns

### Loading State

```typescript
@Component({
  selector: 'app-data-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loading()) {
      <div class="glass p-8 text-center">
        <div
          class="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto"
        ></div>
        <p class="mt-4">Loading...</p>
      </div>
    } @else if (error()) {
      <div class="glass-dark p-6 border-red-500">
        <p class="text-red-500">{{ error() }}</p>
      </div>
    } @else {
      <div class="glass-card p-6">
        @for (item of data(); track item.id) {
          <div class="mb-2">{{ item.name }}</div>
        }
      </div>
    }
  `,
})
export class DataListComponent {
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<any[]>([]);
}
```

### Modal Pattern

```typescript
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
        (click)="close()"
      >
        <div class="glass-card p-6 max-w-md w-full m-4" (click)="$event.stopPropagation()">
          <h2 class="text-2xl mb-4">{{ title }}</h2>
          <ng-content></ng-content>
          <div class="flex gap-4 mt-6">
            <button class="outer-button flex-1" (click)="close()">Cancel</button>
            <button class="inner-button flex-1" (click)="confirm()">Confirm</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  isOpen = signal(false);
  @Input() title = '';
  @Output() confirmed = new EventEmitter();

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  confirm() {
    this.confirmed.emit();
    this.close();
  }
}
```

## Important Reminders

1. **🚨 Tailwind CSS 4 ONLY** - Never use v3 syntax, always use `@idem/shared-styles`
2. **Always use the design system** from `@idem/shared-styles` package
3. **Use Angular 20 features**: signals, inject(), new control flow
4. **Standalone components only** - no NgModules
5. **Use Angular MCP** for Angular-specific questions
6. **Follow Tailwind CSS 4 syntax** - no deprecated utilities (see table above)
7. **Dark theme only** - all UIs must support dark mode
8. **Glass morphism** - use glass effects for all containers
9. **Type safety** - use TypeScript strictly
10. **Test your code** - write unit and integration tests
11. **Performance** - use OnPush, lazy loading, and track by

## Additional Resources

- [Angular 20 Documentation](https://angular.dev)
- [Tailwind CSS 4 Documentation](https://tailwindcss.com)
- [PrimeNG Documentation](https://primeng.org)
- [Main Monorepo CLAUDE.md](../../CLAUDE.md)

---

**Remember**: Consistency with the design system is paramount. Every UI element should feel cohesive with the dark glass theme.
