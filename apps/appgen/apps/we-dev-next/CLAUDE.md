# CLAUDE.md - We Dev Next (Next.js 15)

This file provides guidance to **Claude Code** when working with the **we-dev-next** Next.js application.

## Project Overview

We Dev Next is a Next.js 15 application providing documentation, authentication, and advanced features for the We Dev platform. It leverages the App Router, Server Components, and Server Actions for optimal performance.

## Technology Stack

- **Framework**: Next.js 15.1.2
- **React**: 18.3.1
- **Styling**: Tailwind CSS 3.4.1 (will migrate to 4.x)
- **UI Components**: Radix UI, Ant Design 5.23.0
- **Icons**: Lucide React, React Icons
- **Documentation**: Fumadocs (MDX-based)
- **Animation**: Framer Motion 11.18.0, GSAP 3.12.5
- **State Management**: Zustand 5.0.3
- **AI Integration**: Vercel AI SDK, OpenAI, DeepSeek, Google AI
- **Database**: MongoDB (Mongoose 8.9.3)
- **Authentication**: JWT (jsonwebtoken, jose)
- **Storage**: MinIO 8.0.4
- **Payment**: Stripe 17.7.0
- **Internationalization**: next-intl 3.26.3
- **Validation**: Zod 3.24.1

## MCP Integration

**Use the Next.js MCP** for all Next.js-specific queries and code generation.

The MCP provides:

- Next.js 15 best practices
- App Router patterns
- Server Components vs Client Components
- Server Actions
- Caching strategies
- Metadata API

## Design System - CRITICAL

**ALL UI COMPONENTS MUST FOLLOW THE IDEM DESIGN SYSTEM**

**🚨 MANDATORY: This project uses Tailwind CSS 4.x and `@idem/shared-styles` package.**

### Shared Styles Integration

This project uses the **`@idem/shared-styles`** package for consistent design.

**Installation:**

```bash
npm install @idem/shared-styles
```

**Import in app/globals.css:**

```css
@import '@idem/shared-styles/styles.css';
```

**Extend in tailwind.config.ts:**

```typescript
import type { Config } from 'tailwindcss';
import sharedConfig from '@idem/shared-styles/tailwind.config';

const config: Config = {
  ...sharedConfig,
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;
```

### Theme Configuration

The design system is defined in `@idem/shared-styles`. **ALWAYS** use this shared package.

#### Global Styles (app/globals.css)

**🚨 CRITICAL: Use Tailwind 4 import syntax**

```css
/* Import shared design system (includes Tailwind 4) */
@import '@idem/shared-styles/styles.css';

/* DO NOT USE these v3 directives:
@tailwind base;
@tailwind components;
@tailwind utilities;
*/

@import url('https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap');

/* Force dark mode */
:root {
  color-scheme: dark;

  --color-primary: #1447e6;
  --color-secondary: #d11ec0;
  --color-accent: #22d3ee;
  --color-primary-glow: rgba(20, 73, 230, 0.66);
  --color-secondary-glow: rgba(209, 30, 192, 0.66);
  --color-accent-glow: rgba(34, 211, 238, 0.6);

  --color-bg-dark: #06080d;
  --color-bg-light: #0f141b;
  --color-light-text: #f5f5f5;
  --color-success: #219653;
  --color-danger: #d34053;
  --color-warning: #ffa70b;

  --glass-bg: rgba(15, 20, 27, 0.4);
  --glass-bg-darker: rgba(20, 20, 30, 0.6);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glass-blur: 8px;
}

* {
  font-family: 'Jura', sans-serif;
  scroll-behavior: smooth;
}

body {
  background-color: var(--color-bg-dark);
  background-size: 50px 50px;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  min-height: 100vh;
  overflow-x: hidden;
}

@layer components {
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

  .inner-button {
    background: linear-gradient(135deg, var(--color-primary), var(--color-primary-glow));
    background-size: 200% 100%;
    animation: gradient-shift 3s ease infinite;
    color: white;
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.5px;
    border: none;
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .inner-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(60, 164, 250, 0.4);
  }

  .outer-button {
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
  }

  .input {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
    color: var(--color-light-text);
    padding: 0.8rem 1rem;
    border-radius: 8px;
    transition: all 0.3s ease;
    width: 100%;
  }

  .input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-glow);
  }
}

@keyframes gradient-shift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
```

### Tailwind Configuration

**🚨 Use shared configuration - DO NOT redefine design tokens**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import sharedConfig from '@idem/shared-styles/tailwind.config';

const config: Config = {
  ...sharedConfig,
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      ...sharedConfig.theme.extend,
      // Only add Next.js-specific extensions if absolutely necessary
      // DO NOT redefine colors, fonts, or other design tokens
    },
  },
};

export default config;
```

**Colors, fonts, and design tokens come from `@idem/shared-styles` - never redefine them.**

## Next.js 15 Best Practices

### App Router Structure

```
app/
├── (auth)/              # Route group for auth pages
│   ├── login/
│   └── register/
├── (dashboard)/         # Route group for dashboard
│   ├── layout.tsx
│   └── page.tsx
├── api/                 # API routes
│   └── users/
│       └── route.ts
├── layout.tsx           # Root layout
├── page.tsx             # Home page
└── globals.css          # Global styles
```

### Server Components (Default)

**Use Server Components by default** for better performance:

```tsx
// app/page.tsx
import { Suspense } from 'react';
import { UserList } from '@/components/UserList';
import { Skeleton } from '@/components/ui/Skeleton';

export default async function HomePage() {
  // Fetch data directly in Server Component
  const users = await fetch('https://api.example.com/users').then((r) => r.json());

  return (
    <main className="container mx-auto p-6">
      <div className="glass-card p-8">
        <h1 className="text-4xl text-light-text mb-6">Users</h1>
        <Suspense fallback={<Skeleton />}>
          <UserList users={users} />
        </Suspense>
      </div>
    </main>
  );
}
```

### Client Components

**Use 'use client' only when needed** (interactivity, hooks, browser APIs):

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <motion.div className="glass-card p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h2 className="text-2xl text-light-text mb-4">Count: {count}</h2>
      <button className="inner-button" onClick={() => setCount((c) => c + 1)}>
        Increment
      </button>
    </motion.div>
  );
}
```

### Server Actions

**Use Server Actions for mutations:**

```tsx
// app/actions/user.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

export async function createUser(formData: FormData) {
  const validatedFields = userSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Save to database
  await db.user.create({
    data: validatedFields.data,
  });

  revalidatePath('/users');
  return { success: true };
}
```

```tsx
// app/users/new/page.tsx
'use client';

import { useFormState } from 'react-dom';
import { createUser } from '@/app/actions/user';

export default function NewUserPage() {
  const [state, formAction] = useFormState(createUser, null);

  return (
    <form action={formAction} className="glass-card p-6">
      <div className="mb-4">
        <label className="block text-sm text-light-text mb-2">Name</label>
        <input name="name" className="input" />
        {state?.errors?.name && <p className="text-red-500 text-sm mt-1">{state.errors.name}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-sm text-light-text mb-2">Email</label>
        <input name="email" type="email" className="input" />
        {state?.errors?.email && <p className="text-red-500 text-sm mt-1">{state.errors.email}</p>}
      </div>

      <button type="submit" className="inner-button w-full">
        Create User
      </button>
    </form>
  );
}
```

### API Routes

```tsx
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

export async function GET(request: NextRequest) {
  try {
    const users = await db.user.findMany();
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = userSchema.parse(body);

    const user = await db.user.create({
      data: validatedData,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
```

### Layouts

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'We Dev Next',
  description: 'Next.js development platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
```

```tsx
// app/(dashboard)/layout.tsx
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Navbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

### Metadata API

```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.image],
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const post = await getPost(params.slug);

  return (
    <article className="glass-card p-8">
      <h1 className="text-4xl text-light-text mb-4">{post.title}</h1>
      <div className="prose prose-invert">{post.content}</div>
    </article>
  );
}
```

### Data Fetching

```tsx
// Fetch with caching
async function getUsers() {
  const res = await fetch('https://api.example.com/users', {
    next: { revalidate: 3600 }, // Revalidate every hour
  });
  return res.json();
}

// Fetch without caching
async function getLiveData() {
  const res = await fetch('https://api.example.com/live', {
    cache: 'no-store',
  });
  return res.json();
}

// Fetch with tags for on-demand revalidation
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { tags: ['products'] },
  });
  return res.json();
}
```

## Component Patterns

### Reusable UI Components

```tsx
// components/ui/Button.tsx
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(variant === 'primary' ? 'inner-button' : 'outer-button', className)}
      {...props}
    >
      {children}
    </button>
  );
}
```

```tsx
// components/ui/Card.tsx
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = true }: CardProps) {
  return (
    <div className={cn('glass-card p-6', hover && 'hover:scale-[1.02]', className)}>{children}</div>
  );
}
```

### Loading States

```tsx
// components/ui/Skeleton.tsx
export function Skeleton() {
  return (
    <div className="glass p-6 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-white/10 rounded w-1/2 mb-4"></div>
      <div className="h-4 bg-white/10 rounded w-5/6"></div>
    </div>
  );
}
```

```tsx
// app/users/loading.tsx
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}
```

### Error Handling

```tsx
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="glass-dark p-8 border border-red-500 text-center">
      <h2 className="text-2xl text-red-500 mb-4">Something went wrong!</h2>
      <p className="text-light-text mb-6">{error.message}</p>
      <button className="inner-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
```

## Authentication Pattern

```tsx
// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function createToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const token = cookies().get('token')?.value;
  if (!token) return null;
  return await verifyToken(token);
}
```

```tsx
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

## Database Integration (MongoDB)

```tsx
// lib/db.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => {
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
```

```tsx
// models/User.ts
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
```

## Internationalization

```tsx
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

```tsx
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

## Important Reminders

1. **🚨 Tailwind CSS 4 ONLY** - Never use v3 syntax, always use `@idem/shared-styles`
2. **Always use the design system** - from `@idem/shared-styles` package
3. **Use Next.js MCP** for Next.js-specific questions
4. **Server Components by default** - use 'use client' sparingly
5. **Server Actions** for mutations
6. **Proper caching strategies** - understand revalidation
7. **TypeScript strictly** - type everything
8. **Error boundaries** - handle errors gracefully
9. **Metadata API** - SEO optimization
10. **Route groups** for organization
11. **Middleware** for authentication and authorization
12. **NO Tailwind v3 utilities** - use v4 syntax (bg-black/50 not bg-opacity-50)

## Additional Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Main Monorepo CLAUDE.md](../../../../CLAUDE.md)

---

**Remember**: Leverage Server Components for performance and use the unified dark glass design system across all pages.
