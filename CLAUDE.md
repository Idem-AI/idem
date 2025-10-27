# CLAUDE.md - Idem Monorepo

This file provides guidance to **Claude Code** (claude.ai/code) when working with code in this monorepo.

## Project Overview

Idem is a comprehensive monorepo containing multiple applications for architecture, diagram generation, deployment, and development tools. The monorepo includes:

- **main-app**: Angular 20 application (primary UI)
- **api**: Express.js backend API
- **appgen**: Application generation tools
  - **we-dev-client**: React + Vite client
  - **we-dev-next**: Next.js 15 application
- **chart**: Svelte 5 diagram/chart editor
- **ideploy**: Laravel-based deployment platform (Coolify fork)

## Monorepo Structure

This is an **npm workspaces** monorepo. All projects share dependencies where possible.

```
idem/
├── apps/
│   ├── main-app/          # Angular 20 + Tailwind 4
│   ├── api/               # Express.js API
│   ├── appgen/
│   │   ├── we-dev-client/ # React + Vite
│   │   └── we-dev-next/   # Next.js 15
│   ├── chart/             # Svelte 5
│   └── ideploy/           # Laravel (PHP)
├── packages/
│   ├── shared-auth-client/
│   └── shared-models/
└── documentation/
```

## Global Development Guidelines

### Design System - CRITICAL

**ALL UI GENERATION MUST FOLLOW THESE SPECIFICATIONS:**

**🚨 MANDATORY: All frontend applications MUST use Tailwind CSS 4.x and the shared design system from `@idem/shared-styles`.**

#### Shared Styles Package

All frontend projects use the **`@idem/shared-styles`** package which provides:

- Unified design system with Tailwind CSS 4
- Pre-built glass morphism components
- Consistent color palette and typography
- Reusable utility classes

**Installation:**

```bash
npm install @idem/shared-styles
```

**Usage in CSS:**

```css
@import '@idem/shared-styles/styles.css';
```

**Usage in Tailwind Config:**

```js
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx,svelte,vue}'],
};
```

#### Theme Configuration

All applications MUST use the **dark theme** with glass morphism effects defined in `@idem/shared-styles`.

**Core Colors:**

- Primary: `#1447e6` (blue)
- Secondary: `#d11ec0` (magenta)
- Accent: `#22d3ee` (cyan)
- Background Dark: `#06080d`
- Background Light: `#0f141b`

**Glass Effects:**

```css
/* Use these classes in all generated UIs */
.glass {
  background: rgba(15, 20, 27, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.glass-dark {
  background: rgba(20, 20, 30, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.glass-card {
  background: rgba(15, 20, 27, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  transition: all 0.3s ease;
}
```

**Glow Effects:**

```css
.glow-primary {
  box-shadow: 0 0 15px rgba(20, 73, 230, 0.66);
}
.glow-secondary {
  box-shadow: 0 0 15px rgba(209, 30, 192, 0.66);
}
.glow-accent {
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.6);
}
```

**Typography:**

- Font Family: 'Jura', sans-serif
- Always use smooth scrolling
- Light text: `#f5f5f5`

**Background:**

- Grid pattern with `50px` cells
- Base color: `#06080d`

#### Button Styles

Use these button classes consistently:

```css
/* Glass button with border */
.outer-button {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
}

/* Gradient button with animation */
.inner-button {
  background: linear-gradient(135deg, #1447e6, rgba(20, 73, 230, 0.66));
  background-size: 200% 100%;
  animation: gradient-shift 3s ease infinite;
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
  border: none;
}
```

#### Form Elements

```css
.input {
  background: rgba(15, 20, 27, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f5f5f5;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.input:focus {
  border-color: #1447e6;
  box-shadow: 0 0 0 2px rgba(20, 73, 230, 0.66);
}
```

### MCP (Model Context Protocol) Integration

This monorepo uses **MCP servers** for enhanced AI assistance. When working with specific frameworks, use the appropriate MCP:

#### Available MCP Servers

1. **Angular 20 MCP** - For `main-app`
   - Use for Angular-specific queries
   - Covers Angular 20 features, signals, standalone components

2. **Tailwind CSS 4 MCP** - For all projects
   - Use for Tailwind v4 utilities
   - Note: v4 uses `@import "tailwindcss"` not `@tailwind` directives

3. **React MCP** - For `we-dev-client`
   - React 18 patterns
   - Hooks, context, modern patterns

4. **Next.js MCP** - For `we-dev-next`
   - Next.js 15 features
   - App Router, Server Components, Server Actions

5. **Svelte MCP** - For `chart`
   - Svelte 5 features
   - Runes, snippets, modern Svelte

6. **Express.js MCP** - For `api`
   - Latest Express patterns
   - Middleware, routing, error handling

### Code Quality Standards

**CRITICAL RULES:**

1. **Tailwind CSS 4 ONLY**: ALL UI generation MUST use Tailwind CSS 4.x syntax - NO Tailwind v3 syntax allowed
2. **Shared Styles**: ALWAYS import and use `@idem/shared-styles` for design system
3. **Design Consistency**: ALL generated UIs must use the dark theme with glass effects from shared-styles
4. **Best Practices**: Follow framework-specific best practices
5. **Type Safety**: Use TypeScript strictly (except PHP projects)
6. **Testing**: Write tests for new features
7. **Documentation**: Document complex logic
8. **Performance**: Consider performance implications
9. **Accessibility**: Ensure WCAG 2.1 AA compliance

### Framework-Specific Guidelines

#### Angular (main-app)

- Use standalone components
- Leverage signals for reactivity
- Follow Angular style guide
- Use dependency injection properly

#### React (we-dev-client)

- Functional components only
- Custom hooks for reusable logic
- Proper dependency arrays in useEffect
- Memoization when appropriate

#### Next.js (we-dev-next)

- Use App Router
- Server Components by default
- Client Components only when needed
- Server Actions for mutations

#### Svelte (chart)

- Use Svelte 5 runes ($state, $derived, $effect)
- Reactive statements
- Component composition
- Store patterns

#### Express.js (api)

- Async/await for all async operations
- Proper error handling middleware
- Input validation
- Security best practices (helmet, cors, rate limiting)

### Styling Guidelines

**🚨 TAILWIND CSS 4 - MANDATORY FOR ALL FRONTEND PROJECTS 🚨**

**CRITICAL REQUIREMENTS:**

1. **Use `@idem/shared-styles`** - Import the shared design system in every frontend project
2. **Tailwind 4 syntax ONLY** - Never use Tailwind v3 syntax
3. **Import syntax**: Use `@import 'tailwindcss'` or `@import '@idem/shared-styles/styles.css'`
4. **NO legacy directives**: Never use `@tailwind base`, `@tailwind components`, `@tailwind utilities`

**Tailwind 4 Updated Syntax:**

| ❌ NEVER USE (v3)   | ✅ ALWAYS USE (v4)      |
| ------------------- | ----------------------- |
| `@tailwind base`    | `@import 'tailwindcss'` |
| `bg-opacity-50`     | `bg-black/50`           |
| `text-opacity-80`   | `text-white/80`         |
| `flex-shrink-0`     | `shrink-0`              |
| `flex-grow-1`       | `grow`                  |
| `overflow-ellipsis` | `text-ellipsis`         |

**Design System Usage:**

```css
/* In your main CSS file */
@import '@idem/shared-styles/styles.css';
```

```js
// In tailwind.config.js
import sharedConfig from '@idem/shared-styles/tailwind.config';

export default {
  ...sharedConfig,
  content: ['./src/**/*.{js,ts,jsx,tsx,svelte,vue}'],
};
```

**Key Features:**

- Responsive design: mobile-first
- Dark mode: default and only mode
- Glass morphism utilities built-in
- Consistent color palette across all apps

### Testing Strategy

- **Unit Tests**: For isolated logic
- **Integration Tests**: For component interactions
- **E2E Tests**: For critical user flows
- **Test Coverage**: Aim for >80% on critical paths

### Git Workflow

- **Branches**: Feature branches from `main`
- **Commits**: Conventional commits format
- **PRs**: Required for all changes
- **Reviews**: At least one approval required

### Performance Guidelines

- **Code Splitting**: Lazy load routes and heavy components
- **Bundle Size**: Monitor and optimize
- **Images**: Use optimized formats (WebP, AVIF)
- **Caching**: Implement appropriate caching strategies
- **API Calls**: Debounce/throttle when appropriate

### Security Guidelines

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-based access control
- **Input Validation**: Validate all user inputs
- **XSS Prevention**: Sanitize outputs
- **CSRF Protection**: Use tokens
- **Rate Limiting**: Implement on API endpoints

## Project-Specific Documentation

Each project has its own `CLAUDE.md` with detailed guidelines:

- [main-app/CLAUDE.md](apps/main-app/CLAUDE.md) - Angular 20 application
- [api/CLAUDE.md](apps/api/CLAUDE.md) - Express.js API
- [appgen/apps/we-dev-client/CLAUDE.md](apps/appgen/apps/we-dev-client/CLAUDE.md) - React client
- [appgen/apps/we-dev-next/CLAUDE.md](apps/appgen/apps/we-dev-next/CLAUDE.md) - Next.js app
- [chart/CLAUDE.md](apps/chart/CLAUDE.md) - Svelte chart editor
- [ideploy/CLAUDE.md](apps/ideploy/CLAUDE.md) - Laravel deployment platform

## Common Commands

### Install Dependencies

```bash
npm install
```

### Development

```bash
# Run specific app
cd apps/[app-name]
npm run dev

# Run all apps (if configured)
npm run dev
```

### Build

```bash
# Build specific app
cd apps/[app-name]
npm run build

# Build all
npm run build --workspaces
```

### Testing

```bash
# Test specific app
cd apps/[app-name]
npm test

# Test all
npm test --workspaces
```

## Important Notes

1. **Always check project-specific CLAUDE.md** before making changes
2. **Use MCP servers** for framework-specific queries
3. **Follow design system** strictly for all UI generation
4. **Write tests** for new features
5. **Document breaking changes**
6. **Consider cross-project impacts** in monorepo

## Getting Help

- Check project-specific CLAUDE.md files
- Use appropriate MCP server for framework questions
- Review existing code patterns
- Consult documentation/ folder for architecture details

---

**Remember**: Consistency is key in a monorepo. Always follow established patterns and the unified design system.
