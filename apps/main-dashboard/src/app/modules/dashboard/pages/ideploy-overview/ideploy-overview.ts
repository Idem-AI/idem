import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IDeployService } from '../../services/ideploy.service';
import { IDeploySummary } from '../../models/ideploy.model';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ideploy-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ideploy-overview.html',
  styleUrls: ['./ideploy-overview.css'],
})
export class IDeployOverview implements OnInit {
  private readonly ideployService = inject(IDeployService);

  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<IDeploySummary | null>(null);
  protected readonly ideployUrl = environment.services.ideploy.url;

  protected readonly stats = computed(() => this.summary()?.stats ?? null);
  protected readonly servers = computed(() => this.summary()?.servers ?? []);

  protected readonly appsWithUrl = computed(() =>
    (this.summary()?.applications ?? []).filter(a => a.fqdn)
  );

  protected readonly appsWithoutUrl = computed(() =>
    (this.summary()?.applications ?? []).filter(a => !a.fqdn)
  );

  protected readonly recentDatabases = computed(() =>
    (this.summary()?.databases ?? []).slice(0, 5)
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.ideployService.getSummary()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: data => this.summary.set(data),
        error: () => this.error.set('Impossible de contacter iDeploy. Vérifiez la configuration.'),
      });
  }

  protected openIDeploy(path = ''): void {
    window.open(`${this.ideployUrl}${path}`, '_blank');
  }

  protected getStatusClass(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.startsWith('running')) return 'status-running';
    if (s.includes('exited') || s.includes('stop')) return 'status-stopped';
    if (s.includes('restart') || s.includes('deploy') || s.includes('start')) return 'status-building';
    return 'status-unknown';
  }

  protected getStatusLabel(status: string): string {
    const s = (status ?? '').toLowerCase();
    if (s.startsWith('running')) return 'Running';
    if (s.includes('exited') || s.includes('stop')) return 'Stopped';
    if (s.includes('restart')) return 'Restarting';
    if (s.includes('deploy') || s.includes('start')) return 'Deploying';
    return status?.split(':')[0] || 'Unknown';
  }

  protected getBuildPackIcon(pack: string): string {
    const p = (pack ?? '').toLowerCase();
    if (p.includes('docker')) return 'pi-box';
    if (p.includes('nixpack')) return 'pi-server';
    if (p.includes('static')) return 'pi-globe';
    return 'pi-code';
  }

  protected getDatabaseEmoji(type: string): string {
    const t = (type ?? '').toLowerCase();
    if (t.includes('postgres')) return '🐘';
    if (t.includes('mysql') || t.includes('maria')) return '🐬';
    if (t.includes('mongo')) return '🍃';
    if (t.includes('redis')) return '⚡';
    return '🗄️';
  }

  protected formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  }
}
