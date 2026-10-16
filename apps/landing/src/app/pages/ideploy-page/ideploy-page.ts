import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PageArtComponent, PageArtScene } from '../../shared/components/page-art/page-art';

interface Step {
  title: string;
  description: string;
}

/**
 * Une destination d'hébergement. Les quatre lignes sont les mêmes de part et
 * d'autre — la machine, l'entretien, les données, à qui ça convient — pour que
 * le choix se lise en comparant, et non en lisant deux argumentaires.
 */
interface HostingFork {
  scene: PageArtScene;
  title: string;
  description: string;
  rows: Array<{ label: string; value: string }>;
}

interface Guard {
  title: string;
  description: string;
}

interface CatalogueGroup {
  title: string;
  examples: string;
}

interface Extra {
  title: string;
  description: string;
}

interface EcosystemLink {
  name: string;
  description: string;
  href: string;
}

@Component({
  selector: 'app-ideploy-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageArtComponent],
  templateUrl: './ideploy-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './ideploy-page.css'],
})
export class IdeployPage {
  protected readonly idevUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  protected readonly steps: Step[] = [
    {
      title: $localize`:@@ideploy-page.step.connect.title:Connect your code`,
      description: $localize`:@@ideploy-page.step.connect.description:From GitHub, GitLab or a Dockerfile. An app built with iCode arrives without any of that.`,
    },
    {
      title: $localize`:@@ideploy-page.step.where.title:Choose where it runs`,
      description: $localize`:@@ideploy-page.step.where.description:Our servers, or yours. The same product either way, and the choice can change later.`,
    },
    {
      title: $localize`:@@ideploy-page.step.guard.title:Tick what you need`,
      description: $localize`:@@ideploy-page.step.guard.description:Firewall, vulnerability scans, backups. Each one is a switch in the interface, not a config file.`,
    },
    {
      title: $localize`:@@ideploy-page.step.live.title:It is live`,
      description: $localize`:@@ideploy-page.step.live.description:A web address and its certificate, in under a minute. Every push after that deploys on its own.`,
    },
  ];

  protected readonly hostingForks: HostingFork[] = [
    {
      scene: 'granary-full',
      title: $localize`:@@ideploy-page.fork.idem.title:IDEM infrastructure`,
      description: $localize`:@@ideploy-page.fork.idem.description:You look after nothing. We pick the machine, maintain it and replace it if it fails.`,
      rows: [
        {
          label: $localize`:@@ideploy-page.fork.row.machine:The machine`,
          value: $localize`:@@ideploy-page.fork.idem.machine:Picked and provided by IDEM.`,
        },
        {
          label: $localize`:@@ideploy-page.fork.row.care:Upkeep`,
          value: $localize`:@@ideploy-page.fork.idem.care:Updates, security and replacement after a failure: ours.`,
        },
        {
          label: $localize`:@@ideploy-page.fork.row.data:Your data`,
          value: $localize`:@@ideploy-page.fork.idem.data:Hosted on IDEM infrastructure, under your plan.`,
        },
        {
          label: $localize`:@@ideploy-page.fork.row.fit:Right for you if…`,
          value: $localize`:@@ideploy-page.fork.idem.fit:You want it to run without thinking about it.`,
        },
      ],
    },
    {
      scene: 'granary-lock',
      title: $localize`:@@ideploy-page.fork.own.title:Your own server`,
      description: $localize`:@@ideploy-page.fork.own.description:Plug your VPS in once with an SSH key. iDeploy installs it, secures it and keeps it current.`,
      rows: [
        {
          label: $localize`:@@ideploy-page.fork.row.machine:The machine`,
          value: $localize`:@@ideploy-page.fork.own.machine:Your VPS, plugged in once with an SSH key. No server yet? iDeploy rents one for you.`,
        },
        {
          label: $localize`:@@ideploy-page.fork.row.care:Upkeep`,
          value: $localize`:@@ideploy-page.fork.own.care:iDeploy installs it, secures it and keeps it current.`,
        },
        {
          label: $localize`:@@ideploy-page.fork.row.data:Your data`,
          value: $localize`:@@ideploy-page.fork.own.data:It never leaves your machine.`,
        },
        {
          label: $localize`:@@ideploy-page.fork.row.fit:Right for you if…`,
          value: $localize`:@@ideploy-page.fork.own.fit:You already have a server, or your data has to stay with you.`,
        },
      ],
    },
  ];

  protected readonly guards: Guard[] = [
    {
      title: $localize`:@@ideploy-page.guard.firewall.title:Firewall and WAF`,
      description: $localize`:@@ideploy-page.guard.firewall.description:Block an address or a whole country, throttle the request rate, from the interface.`,
    },
    {
      title: $localize`:@@ideploy-page.guard.scans.title:Scans before release`,
      description: $localize`:@@ideploy-page.guard.scans.description:Code quality and known vulnerabilities are checked on every build. If the check fails, nothing ships.`,
    },
    {
      title: $localize`:@@ideploy-page.guard.monitoring.title:Monitoring`,
      description: $localize`:@@ideploy-page.guard.monitoring.description:Requests, CPU, memory and disk, read continuously for your apps and your servers.`,
    },
    {
      title: $localize`:@@ideploy-page.guard.alerts.title:Alerts where you already talk`,
      description: $localize`:@@ideploy-page.guard.alerts.description:When something breaks, the message arrives in the channel your team is already in.`,
    },
  ];

  protected readonly catalogueGroups: CatalogueGroup[] = [
    {
      title: $localize`:@@ideploy-page.catalogue.site.title:Website and content`,
      examples: 'WordPress, Strapi, Directus',
    },
    {
      title: $localize`:@@ideploy-page.catalogue.business.title:Running the business`,
      examples: 'Odoo, Dolibarr, Invoice Ninja, Nextcloud',
    },
    {
      title: $localize`:@@ideploy-page.catalogue.ai.title:AI and automation`,
      examples: 'n8n, Ollama, Open WebUI, LibreChat',
    },
    {
      title: $localize`:@@ideploy-page.catalogue.backend.title:Your app's back end`,
      examples: 'Supabase, Appwrite, PocketBase, NocoDB',
    },
    {
      title: $localize`:@@ideploy-page.catalogue.monitor.title:Measuring and monitoring`,
      examples: 'Grafana, Uptime Kuma, Umami, Metabase',
    },
    {
      title: $localize`:@@ideploy-page.catalogue.learning.title:Training`,
      examples: 'Moodle',
    },
  ];

  protected readonly extras: Extra[] = [
    {
      title: $localize`:@@ideploy-page.extra.database.title:Databases in one click`,
      description: $localize`:@@ideploy-page.extra.database.description:PostgreSQL, MySQL, MongoDB, Redis and four more engines, backed up automatically.`,
    },
    {
      title: $localize`:@@ideploy-page.extra.workspace.title:Workspaces`,
      description: $localize`:@@ideploy-page.extra.workspace.description:Your site, API and database on a private network, reachable by name.`,
    },
    {
      title: $localize`:@@ideploy-page.extra.preview.title:Preview environments`,
      description: $localize`:@@ideploy-page.extra.preview.description:A test address per pull request, removed when it is merged.`,
    },
    {
      title: $localize`:@@ideploy-page.extra.rollback.title:Rollback`,
      description: $localize`:@@ideploy-page.extra.rollback.description:An earlier version goes back online in one click.`,
    },
    {
      title: $localize`:@@ideploy-page.extra.terminal.title:A terminal in the browser`,
      description: $localize`:@@ideploy-page.extra.terminal.description:A session on the server or inside the container, with no SSH client to set up.`,
    },
    {
      title: $localize`:@@ideploy-page.extra.env.title:Variables picked up`,
      description: $localize`:@@ideploy-page.extra.env.description:Read from your .env.example and shared across projects.`,
    },
    {
      title: $localize`:@@ideploy-page.extra.cron.title:Scheduled tasks and volumes`,
      description: $localize`:@@ideploy-page.extra.cron.description:A command on a schedule, and files that survive deployments.`,
    },
    {
      title: $localize`:@@ideploy-page.extra.team.title:Team`,
      description: $localize`:@@ideploy-page.extra.team.description:Invitations, roles and variables shared across the team.`,
    },
  ];

  /** Ce que le plan gratuit contient vraiment — les chiffres de la grille. */
  protected readonly freePlan: string[] = [
    $localize`:@@ideploy-page.free.apps:2 hosted apps`,
    $localize`:@@ideploy-page.free.deployments:5 free deployments`,
    $localize`:@@ideploy-page.free.domain:A .idem.africa address, plus one custom domain with HTTPS`,
    $localize`:@@ideploy-page.free.database:1 database`,
    $localize`:@@ideploy-page.free.commercial:Commercial use allowed`,
  ];

  protected readonly ecosystem: EcosystemLink[] = [
    {
      name: 'iCode',
      description: $localize`:@@ideploy-page.ecosystem.icode.description:Describe the site or the application you need and it gets written, then handed straight to iDeploy.`,
      href: this.idevUrl,
    },
    {
      name: $localize`:@@ideploy-page.ecosystem.idem.name:The IDEM platform`,
      description: $localize`:@@ideploy-page.ecosystem.idem.description:Brand, business plan, finances and legal papers — the business the application belongs to.`,
      href: this.dashboardUrl,
    },
  ];
}
