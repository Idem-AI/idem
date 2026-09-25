/**
 * Architecture guide templates — "3-Tier Application" and friends, shown on
 * the New Project screen's "Clone Template" panel next to the one-click app
 * templates.
 *
 * Ordered by dependency, not by how a user would casually describe the
 * architecture: the database (and, for microservices, the message broker)
 * always comes first, because it's the thing every other step needs
 * connection details for — deploying a backend before its database exists
 * is exactly what produced a real crash-loop (Spring Boot retrying a MySQL
 * connection that had nothing to connect to, every few seconds, at 200%+
 * CPU, on a real deployment this session debugged live).
 *
 * `guide-session.service.ts` carries each step's real output (the database's
 * actual connection URL, an app's actual public URL) into the next one:
 * `import-config.ts` auto-fills a detected `DATABASE_URL`-shaped variable
 * with the database this guide just created, instead of whatever the
 * repository's own committed `.env` happened to have. That is deliberately
 * narrow — only an unambiguous combined connection-URL variable is
 * auto-filled, never a bare `USERNAME`/`PASSWORD` pair, because a real
 * repository's env list already had a `PAYMENT_USER_NAME`/`PAYMENT_PASSWORD`
 * pair that a looser match would have silently overwritten with database
 * credentials instead of the payment ones they actually were.
 */

export type GuideStepAction = 'import-app' | 'create-database' | 'create-service';

/**
 * What an `import-app` step's deploy is *for*, so the guide session knows
 * what to wire automatically: a `backend` step gets a detected database-URL
 * variable filled with the database this guide already created, and its own
 * public URL is remembered for a later `frontend` step to fill an API-URL
 * variable with. Undefined for anything that isn't a two-sided relationship
 * (a monolith's single app, a static site) — nothing to link in either
 * direction, so nothing is guessed at.
 */
export type GuideStepRole = 'frontend' | 'backend';

export interface GuideStep {
  title: string;
  description: string;
  action: GuideStepAction;
  icon: string;
  role?: GuideStepRole;
}

export interface ArchitectureTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  steps: GuideStep[];
}

export const ARCHITECTURE_TEMPLATES: ArchitectureTemplate[] = [
  {
    id: '3-tier',
    name: 'architectures.threeTier.name',
    icon: 'pi pi-clone',
    description: 'architectures.threeTier.description',
    steps: [
      {
        title: 'architectures.threeTier.step3Title',
        description: 'architectures.threeTier.step3Desc',
        action: 'create-database',
        icon: 'pi pi-database',
      },
      {
        title: 'architectures.threeTier.step2Title',
        description: 'architectures.threeTier.step2Desc',
        action: 'import-app',
        icon: 'pi pi-server',
        role: 'backend',
      },
      {
        title: 'architectures.threeTier.step1Title',
        description: 'architectures.threeTier.step1Desc',
        action: 'import-app',
        icon: 'pi pi-desktop',
        role: 'frontend',
      },
    ],
  },
  {
    id: 'fullstack-monolith',
    name: 'architectures.monolith.name',
    icon: 'pi pi-box',
    description: 'architectures.monolith.description',
    steps: [
      {
        title: 'architectures.monolith.step2Title',
        description: 'architectures.monolith.step2Desc',
        action: 'create-database',
        icon: 'pi pi-database',
      },
      {
        title: 'architectures.monolith.step1Title',
        description: 'architectures.monolith.step1Desc',
        action: 'import-app',
        icon: 'pi pi-sitemap',
        // Not 'backend': a monolith's one app is also the thing a browser
        // hits directly, but it still connects to the database exactly the
        // same way a backend does — the auto-fill only cares about that.
        role: 'backend',
      },
    ],
  },
  {
    id: 'api-database',
    name: 'architectures.apiDb.name',
    icon: 'pi pi-link',
    description: 'architectures.apiDb.description',
    steps: [
      {
        title: 'architectures.apiDb.step2Title',
        description: 'architectures.apiDb.step2Desc',
        action: 'create-database',
        icon: 'pi pi-database',
      },
      {
        title: 'architectures.apiDb.step1Title',
        description: 'architectures.apiDb.step1Desc',
        action: 'import-app',
        icon: 'pi pi-server',
        role: 'backend',
      },
    ],
  },
  {
    id: 'static-site',
    name: 'architectures.staticSite.name',
    icon: 'pi pi-file',
    description: 'architectures.staticSite.description',
    steps: [
      {
        title: 'architectures.staticSite.step1Title',
        description: 'architectures.staticSite.step1Desc',
        action: 'import-app',
        icon: 'pi pi-desktop',
      },
    ],
  },
  {
    id: 'microservices',
    name: 'architectures.microservices.name',
    icon: 'pi pi-sitemap',
    description: 'architectures.microservices.description',
    steps: [
      {
        title: 'architectures.microservices.step3Title',
        description: 'architectures.microservices.step3Desc',
        action: 'create-database',
        icon: 'pi pi-database',
      },
      {
        title: 'architectures.microservices.step4Title',
        description: 'architectures.microservices.step4Desc',
        action: 'create-service',
        icon: 'pi pi-sitemap',
      },
      {
        title: 'architectures.microservices.step1Title',
        description: 'architectures.microservices.step1Desc',
        action: 'import-app',
        icon: 'pi pi-server',
        role: 'backend',
      },
      {
        title: 'architectures.microservices.step2Title',
        description: 'architectures.microservices.step2Desc',
        action: 'import-app',
        icon: 'pi pi-server',
        role: 'backend',
      },
    ],
  },
];

export function getArchitectureTemplate(id: string): ArchitectureTemplate | null {
  return ARCHITECTURE_TEMPLATES.find((t) => t.id === id) ?? null;
}
