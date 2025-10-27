# CLAUDE.md - We Dev Client (React + Vite)

This file provides guidance to **Claude Code** when working with the **we-dev-client** React application.

## Project Overview

We Dev Client is a development tool built with **React 18** and **Vite**. It provides a web-based development environment with code editing, terminal access, and AI-powered assistance.

## Technology Stack

- **Framework**: React 18.2.0
- **Build Tool**: Vite 5.0.8
- **Styling**: Tailwind CSS 3.4.17 (will migrate to 4.x)
- **UI Components**: Ant Design 5.23.0, Radix UI
- **Icons**: Lucide React, React Icons, Ant Design Icons
- **Code Editor**: CodeMirror 6
- **Terminal**: xterm.js 5.5.0
- **State Management**: Zustand 5.0.3
- **AI Integration**: Vercel AI SDK, OpenAI, Google Generative AI
- **Container**: WebContainer API
- **Styling Utilities**: clsx, tailwind-merge, class-variance-authority
- **Animation**: Framer Motion 11.18.0

## MCP Integration

**Use the React MCP** for all React-specific queries and code generation.

The MCP provides:

- React 18 best practices
- Hooks patterns and custom hooks
- Component composition
- Performance optimization
- Modern React patterns

## Design System - CRITICAL

**ALL UI COMPONENTS MUST FOLLOW THE IDEM DESIGN SYSTEM**

**🚨 MANDATORY: This project uses Tailwind CSS 4.x and `@idem/shared-styles` package.**

### Shared Styles Integration

This project has been migrated to use the **`@idem/shared-styles`** package for consistent design.

**Installation:**

```bash
npm install @idem/shared-styles
```

**Import in your CSS:**

```css
@import '@idem/shared-styles/styles.css';
```

**Extend in tailwind.config.js:**

```js
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
};
```

### Theme Configuration

The design system is defined in `@idem/shared-styles`. **ALWAYS** use this shared package instead of custom styles.

#### Core Colors (CSS Variables)

```css
:root {
  --color-primary: #1447e6;
  --color-secondary: #d11ec0;
  --color-accent: #22d3ee;
  --color-primary-glow: rgba(20, 73, 230, 0.66);
  --color-secondary-glow: rgba(209, 30, 192, 0.66);
  --color-accent-glow: rgba(34, 211, 238, 0.6);

  --color-bg-dark: #06080d;
  --color-bg-light: #0f141b;
  --color-light-text: #f5f5f5;

  --glass-bg: rgba(15, 20, 27, 0.4);
  --glass-bg-darker: rgba(20, 20, 30, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glass-blur: 8px;
}
```

#### Glass Morphism Classes

Create these utility classes in your CSS:

```css
.glass {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
}

.glass-dark {
  background: var(--glass-bg-darker);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow);
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: var(--glass-shadow);
  transition: all 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45);
}
```

#### Button Components

```tsx
// GlassButton.tsx
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export const GlassButton = ({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonProps) => {
  const baseClass =
    'px-5 py-3 rounded-lg uppercase font-medium text-sm tracking-wide transition-all duration-300 relative overflow-hidden';

  const variantClass =
    variant === 'primary'
      ? 'bg-gradient-to-br from-[#1447e6] to-[#1447e6aa] hover:shadow-[0_8px_20px_rgba(60,164,250,0.4)]'
      : 'glass border border-white/10 hover:bg-white/10';

  return (
    <button className={cn(baseClass, variantClass, className)} {...props}>
      <span className="relative z-10">{children}</span>
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
    </button>
  );
};
```

#### Input Components

```tsx
// GlassInput.tsx
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const GlassInput = ({ label, className, ...props }: InputProps) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm text-[#f5f5f5] mb-2">{label}</label>}
      <input
        className={cn(
          'w-full px-4 py-3 rounded-lg',
          'glass border border-white/10',
          'text-[#f5f5f5] placeholder:text-white/40',
          'focus:outline-none focus:border-[#1447e6] focus:ring-2 focus:ring-[#1447e6]/50',
          'transition-all duration-300',
          className
        )}
        {...props}
      />
    </div>
  );
};
```

### Tailwind Configuration

**🚨 This project now uses Tailwind CSS 4 with shared configuration.**

Your `tailwind.config.js` should extend the shared config:

```js
import sharedConfig from '@idem/shared-styles/tailwind.config';
import { addDynamicIconSelectors } from '@iconify/tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  ...sharedConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      ...sharedConfig.theme.extend,
      // Add project-specific extensions only if needed
    },
  },
  plugins: [addDynamicIconSelectors()],
};
```

**DO NOT redefine colors, fonts, or design tokens - they come from `@idem/shared-styles`.**

## React Best Practices

### Component Structure

**Use functional components with hooks:**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export const MyComponent = ({ title, onAction }: MyComponentProps) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Side effects
    console.log('Component mounted');

    return () => {
      // Cleanup
      console.log('Component unmounted');
    };
  }, []);

  const handleClick = useCallback(() => {
    setCount((prev) => prev + 1);
    onAction?.();
  }, [onAction]);

  return (
    <div className="glass-card p-6">
      <h2 className="text-2xl text-light-text mb-4">{title}</h2>
      <p className="text-white/80 mb-4">Count: {count}</p>
      <GlassButton onClick={handleClick} disabled={loading}>
        Increment
      </GlassButton>
    </div>
  );
};
```

### Custom Hooks

**Extract reusable logic into custom hooks:**

```tsx
// useLocalStorage.ts
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}
```

```tsx
// useFetch.ts
import { useState, useEffect } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useFetch<T>(url: string) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error as Error });
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
```

### State Management with Zustand

```tsx
// store/useAppStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  theme: 'dark';
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: () => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      user: null,
      setUser: (user) => set({ user }),
      isAuthenticated: () => get().user !== null,
    }),
    {
      name: 'app-storage',
    }
  )
);
```

```tsx
// Usage in component
import { useAppStore } from '@/store/useAppStore';

export const UserProfile = () => {
  const { user, setUser, isAuthenticated } = useAppStore();

  if (!isAuthenticated()) {
    return <div className="glass-card p-6">Please log in</div>;
  }

  return (
    <div className="glass-card p-6">
      <h2 className="text-2xl text-light-text">{user?.name}</h2>
    </div>
  );
};
```

### Performance Optimization

**Use React.memo for expensive components:**

```tsx
import { memo } from 'react';

interface ExpensiveComponentProps {
  data: any[];
  onItemClick: (id: string) => void;
}

export const ExpensiveComponent = memo(
  ({ data, onItemClick }: ExpensiveComponentProps) => {
    return (
      <div className="glass-card p-6">
        {data.map((item) => (
          <div
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className="p-4 hover:bg-white/5 cursor-pointer rounded-lg transition-colors"
          >
            {item.name}
          </div>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison
    return prevProps.data === nextProps.data;
  }
);
```

**Use useMemo and useCallback:**

```tsx
import { useMemo, useCallback } from 'react';

export const DataList = ({ items, filter }: Props) => {
  // Memoize expensive computations
  const filteredItems = useMemo(() => {
    return items.filter((item) => item.name.includes(filter));
  }, [items, filter]);

  // Memoize callbacks
  const handleItemClick = useCallback((id: string) => {
    console.log('Clicked:', id);
  }, []);

  return (
    <div className="glass-card p-6">
      {filteredItems.map((item) => (
        <div key={item.id} onClick={() => handleItemClick(item.id)}>
          {item.name}
        </div>
      ))}
    </div>
  );
};
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── ui/             # UI primitives (buttons, inputs, etc.)
│   ├── layout/         # Layout components
│   └── features/       # Feature-specific components
├── hooks/              # Custom hooks
├── store/              # Zustand stores
├── lib/                # Utilities and helpers
├── services/           # API services
├── types/              # TypeScript types
├── pages/              # Page components
├── assets/             # Static assets
└── App.tsx             # Root component
```

## Common Patterns

### Loading State

```tsx
import { useState } from 'react';

export const DataLoader = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto" />
        <p className="mt-4 text-light-text">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-dark p-6 border border-red-500">
        <p className="text-red-500">{error.message}</p>
      </div>
    );
  }

  return <div className="glass-card p-6">{/* Render data */}</div>;
};
```

### Modal Pattern

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-card p-6 max-w-md w-full m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl text-light-text mb-4">{title}</h2>
            {children}
            <div className="flex gap-4 mt-6">
              <GlassButton variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </GlassButton>
              <GlassButton variant="primary" className="flex-1">
                Confirm
              </GlassButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

### Form Handling

```tsx
import { useState } from 'react';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

type UserForm = z.infer<typeof userSchema>;

export const UserForm = () => {
  const [formData, setFormData] = useState<UserForm>({
    name: '',
    email: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserForm, string>>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = userSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof UserForm, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof UserForm] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Submit form
    console.log('Valid data:', result.data);
    setErrors({});
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6">
      <GlassInput
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}

      <GlassInput
        label="Email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        className="mt-4"
      />
      {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}

      <GlassButton type="submit" className="mt-6 w-full">
        Submit
      </GlassButton>
    </form>
  );
};
```

## Styling with Tailwind

### Responsive Design

```tsx
export const ResponsiveCard = () => {
  return (
    <div className="glass-card p-4 md:p-6 lg:p-8">
      <h2 className="text-xl md:text-2xl lg:text-3xl text-light-text">Responsive Title</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {/* Grid items */}
      </div>
    </div>
  );
};
```

### Animations with Framer Motion

```tsx
import { motion } from 'framer-motion';

export const AnimatedCard = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card p-6"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl text-light-text"
      >
        Animated Content
      </motion.h2>
    </motion.div>
  );
};
```

## Testing

```tsx
// MyComponent.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<MyComponent title="Test" onAction={handleClick} />);

    fireEvent.click(screen.getByText('Increment'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run start

# Type check
npm run tsc
```

## Important Reminders

1. **🚨 Tailwind CSS 4 ONLY** - Never use v3 syntax, always use `@idem/shared-styles`
2. **Always use the design system** - from `@idem/shared-styles` package
3. **Use React MCP** for React-specific questions
4. **Functional components only** - no class components
5. **Custom hooks** for reusable logic
6. **TypeScript strictly** - type everything
7. **Performance** - use memo, useMemo, useCallback appropriately
8. **Accessibility** - use semantic HTML and ARIA attributes
9. **Testing** - write tests for components
10. **Zustand** for global state management
11. **Framer Motion** for animations
12. **NO Tailwind v3 utilities** - see Tailwind 4 migration guide

## Additional Resources

- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Zustand Documentation](https://zustand-demo.pmnd.rs)
- [Main Monorepo CLAUDE.md](../../../../CLAUDE.md)

---

**Remember**: Every UI component must follow the dark glass morphism design system for consistency across the platform.
