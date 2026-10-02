import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { environment } from '../../../../../environments/environment';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state';
import { IDeployApplication, IDeploySummary } from '../../models/ideploy.model';
import { IDeployService } from '../../services/ideploy.service';
import { SiteAppIllustrationComponent } from '../development/site-app-illustration';

/** L'état d'une ressource, dit avec des mots et non avec le code d'iDeploy. */
type RunState = 'running' | 'deploying' | 'restarting' | 'stopped' | 'unknown';

interface TimeAgo {
  key: string;
  params?: Record<string, number>;
}

/**
 * « Mise en ligne » — ce qui tourne sur iDeploy, et comment y ajouter quelque chose.
 *
 * Remplace les anciennes pages de déploiement Terraform : iDeploy est
 * désormais le seul chemin pour mettre en ligne, et cette page n'a que deux
 * questions à servir — « qu'est-ce qui est en ligne ? » et « comment mettre
 * en ligne ce que je viens de construire ? ». Tout le reste se règle dans
 * iDeploy, à un clic.
 */
@Component({
  selector: 'app-ideploy-overview',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, ErrorStateComponent, SiteAppIllustrationComponent],
  templateUrl: './ideploy-overview.html',
  styleUrls: ['./ideploy-overview.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IDeployOverview implements OnInit {
  private readonly ideployService = inject(IDeployService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ideployUrl = environment.services.ideploy.url;

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly summary = signal<IDeploySummary | null>(null);

  protected readonly applications = computed(() => this.summary()?.applications ?? []);
  protected readonly databases = computed(() => this.summary()?.databases ?? []);
  protected readonly servers = computed(() => this.summary()?.servers ?? []);
  protected readonly isEmpty = computed(
    () => this.applications().length === 0 && this.databases().length === 0,
  );

  protected readonly brief = computed(() => {
    const apps = this.applications();
    const servers = this.servers();
    return {
      running: apps.filter((app) => this.state(app.status) === 'running').length,
      apps: apps.length,
      databases: this.databases().length,
      servers: servers.length,
      reachable: servers.filter((server) => server.is_reachable).length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.ideployService
      .getSummary()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => this.summary.set(data),
        error: () => this.failed.set(true),
      });
  }

  /** Ouvre une page d'iDeploy dans un nouvel onglet. */
  protected openIDeploy(path = ''): void {
    window.open(`${this.ideployUrl}${path}`, '_blank', 'noopener');
  }

  protected state(status: string | null | undefined): RunState {
    const s = (status ?? '').toLowerCase();
    if (s.startsWith('running') || s.startsWith('healthy')) return 'running';
    if (s.includes('restart')) return 'restarting';
    if (s.includes('deploy') || s.includes('start') || s.includes('build')) return 'deploying';
    if (s.includes('exited') || s.includes('stop') || s.includes('degraded')) return 'stopped';
    return 'unknown';
  }

  protected url(app: IDeployApplication): string | null {
    // iDeploy peut garder plusieurs domaines, séparés par des virgules : le
    // premier est l'adresse principale.
    const first = app.fqdn?.split(',')[0]?.trim();
    return first || null;
  }

  protected databaseLabel(type: string): string {
    const t = (type ?? '').toLowerCase().replace(/^standalone-/, '');
    const names: Record<string, string> = {
      postgresql: 'PostgreSQL',
      mysql: 'MySQL',
      mariadb: 'MariaDB',
      mongodb: 'MongoDB',
      redis: 'Redis',
      keydb: 'KeyDB',
      dragonfly: 'Dragonfly',
      clickhouse: 'ClickHouse',
    };
    return names[t] ?? t;
  }

  protected timeAgo(date: string | null | undefined): TimeAgo | null {
    if (!date) return null;
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (Number.isNaN(minutes)) return null;
    if (minutes < 1) return { key: 'dashboard.goLive.time.now' };
    if (minutes < 60) return { key: 'dashboard.goLive.time.minutes', params: { n: minutes } };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { key: 'dashboard.goLive.time.hours', params: { n: hours } };
    return { key: 'dashboard.goLive.time.days', params: { n: Math.floor(hours / 24) } };
  }
}
