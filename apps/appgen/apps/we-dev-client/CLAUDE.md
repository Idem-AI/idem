# CLAUDE.md - We Dev Client (React + Vite)

This file provides guidance to **Claude Code** when working with the **we-dev-client** React application.

## Project Overview

We Dev Client is a development tool built with **React 18** and **Vite**. It provides a web-based development environment with code editing, terminal access, and AI-powered assistance.

## Technology Stack

- **Framework**: React 18.2.0
- **Build Tool**: Vite 5.0.8
- **Styling**: Tailwind CSS 4.0.15 (CSS-first configuration)
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

**🚨 MANDATORY: This project uses Tailwind CSS 4.x with CSS-first configuration and `@idem/shared-styles` package.**

### Shared Styles Integration

This project uses **`@idem/shared-styles`** for consistent design across all Idem applications.

**Configuration is in `global.css`:**

```css
/* Import shared design system (includes Tailwind 4) */
@import '@idem/shared-styles/styles.css';

/* Project-specific extensions */
@theme {
  --font-montserrat: 'Montserrat', sans-serif;
  --font-raleway: 'Raleway', sans-serif;
}
```

**NO `tailwind.config.js` needed** - Everything is configured in CSS (Tailwind 4 approach).

### Theme Configuration

The design system is defined in `@idem/shared-styles`. **ALWAYS** use this shared package instead of custom styles.

#### Core Colors (oklch)

All colors use **oklch** color space from `@idem/shared-styles`:

```css
--color-primary: oklch(0.55 0.22 264) /* Blue */ --color-secondary: oklch(0.6 0.25 328)
  /* Magenta */ --color-accent: oklch(0.75 0.15 195) /* Cyan */ --color-bg-dark: oklch(0.1 0.01 264)
  /* Dark background */ --color-bg-light: oklch(0.15 0.01 264) /* Light background */
  --color-light-text: oklch(0.96 0 0) /* White text */ --color-success: oklch(0.55 0.15 145)
  /* Green */ --color-danger: oklch(0.58 0.2 25) /* Red */ --color-warning: oklch(0.7 0.18 75)
  /* Orange */;
```

**Use Tailwind utilities:**

```tsx
<div className="bg-primary text-light-text">
<button className="bg-secondary hover:bg-secondary/80">
```

#### Glass Morphism Classes

**Use these classes from `@idem/shared-styles`:**

```tsx
// Standard glass effect
<div className="glass rounded-2xl p-6">
  {/* Content */}
</div>

// Darker glass
<div className="glass-dark rounded-2xl p-6">
  {/* Content */}
</div>

// Glass card with hover
<div className="glass-card p-6">
  {/* Content */}
</div>
```

**DO NOT redefine these classes** - they come from `@idem/shared-styles`.

#### Button Components

**Use classes from `@idem/shared-styles`:**

```tsx
// Primary button with gradient
<button className="inner-button">
  Primary Action
</button>

// Secondary glass button
<button className="outer-button">
  Secondary Action
</button>

// With Tailwind utilities
<button className="inner-button hover:-translate-y-0.5">
  Hover Effect
</button>
```

**Custom Button Component:**

```tsx
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'inner' | 'outer';
}

export const Button = ({ variant = 'inner', className, children, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(variant === 'inner' ? 'inner-button' : 'outer-button', className)}
      {...props}
    >
      {children}
    </button>
  );
};
```

#### Input Components

**Use `.input` class from `@idem/shared-styles`:**

```tsx
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = ({ label, className, ...props }: InputProps) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm text-light-text mb-2">{label}</label>}
      <input className={cn('input', className)} {...props} />
    </div>
  );
};
```

**The `.input` class includes:**

- Glass background with blur
- Border with focus states
- Proper text colors
- Smooth transitions

### Tailwind CSS 4 - CSS-First Configuration

**🚨 CRITICAL**: This project uses Tailwind CSS 4 with CSS-first configuration.

**NO `tailwind.config.js` file** - Everything is configured in `global.css`:

```css
/* global.css */
@import '@idem/shared-styles/styles.css';

@theme {
  /* Project-specific extensions */
  --font-montserrat: 'Montserrat', sans-serif;
  --font-raleway: 'Raleway', sans-serif;
}
```

#### Tailwind 4 Syntax - MANDATORY

| ❌ NEVER USE (v3)   | ✅ ALWAYS USE (v4)      |
| ------------------- | ----------------------- |
| `@tailwind base`    | `@import 'tailwindcss'` |
| `bg-opacity-50`     | `bg-black/50`           |
| `text-opacity-80`   | `text-white/80`         |
| `flex-shrink-0`     | `shrink-0`              |
| `flex-grow-1`       | `grow`                  |
| `overflow-ellipsis` | `text-ellipsis`         |

**Examples:**

```tsx
// ✅ Correct (v4)
<div className="bg-black/50 text-white/80 shrink-0">

// ❌ Wrong (v3) - DO NOT USE
<div className="bg-opacity-50 text-opacity-80 flex-shrink-0">
```

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
