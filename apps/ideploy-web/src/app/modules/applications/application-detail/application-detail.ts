import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';
import {
  Application,
  AppVolumes,
  DeploymentHistoryItem,
  EnvVar,
  FirewallConfig,
  FirewallRule,
  ScheduledTask,
} from '../../../shared/models/ideploy.models';

/**
 * Application detail — config (General/Source), environment variables,
 * lifecycle actions, and deployment history with rollback. Mirrors the
 * Livewire Application configuration screens.
 */
@Component({
  selector: 'app-application-detail',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (app(); as a) {
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ a.name }}</h1>
        <div class="flex items-center gap-2">
          @if (a.link) {
            <a class="button-secondary" [href]="a.link" target="_blank" rel="noopener">
              <i class="fa-solid fa-arrow-up-right-from-square mr-2"></i>Open
            </a>
          }
          <button class="button-secondary" (click)="lifecycle('restart')">Restart</button>
          <button class="button-secondary" (click)="lifecycle('stop')">Stop</button>
          <button class="button" (click)="deploy()">Deploy</button>
        </div>
      </div>

      <!-- Config -->
      <section class="box mb-6">
        <h2 class="mb-3 font-semibold">Configuration</h2>
        <form class="space-y-3" [formGroup]="configForm" (ngSubmit)="saveConfig()">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-sm">Git repository</label>
              <input class="input" formControlName="git_repository" />
            </div>
            <div>
              <label class="mb-1 block text-sm">Branch</label>
              <input class="input" formControlName="git_branch" />
            </div>
            <div>
              <label class="mb-1 block text-sm">Build pack</label>
              <input class="input" formControlName="build_pack" />
            </div>
            <div>
              <label class="mb-1 block text-sm">FQDN</label>
              <input class="input" formControlName="fqdn" />
            </div>
          </div>
          <button class="button" type="submit" [disabled]="savingConfig()">Save</button>
        </form>
      </section>

      <!-- Env vars -->
      <section class="box mb-6">
        <h2 class="mb-3 font-semibold">Environment variables</h2>
        @for (env of envVars(); track env.key) {
          <div class="mb-2 flex items-center gap-2">
            <code class="text-sm">{{ env.key }}</code>
            <span class="text-sm" style="color: var(--color-text-secondary)">= {{ env.value }}</span>
            <button class="ml-auto text-xs text-red-400" (click)="removeEnv(env)">remove</button>
          </div>
        }
        <form class="mt-3 flex gap-2" [formGroup]="envForm" (ngSubmit)="addEnv()">
          <input class="input flex-1" placeholder="KEY" formControlName="key" />
          <input class="input flex-1" placeholder="value" formControlName="value" />
          <button class="button" type="submit" [disabled]="envForm.invalid">Add</button>
        </form>
      </section>

      <!-- Scheduled tasks -->
      <section class="box mb-6">
        <h2 class="mb-3 font-semibold">Scheduled tasks</h2>
        @for (task of tasks(); track task.uuid) {
          <div class="mb-2 flex items-center gap-3 text-sm">
            <span class="font-semibold">{{ task.name }}</span>
            <code>{{ task.command }}</code>
            <span style="color: var(--color-text-secondary)">{{ task.frequency }}</span>
            <button class="ml-auto text-xs" (click)="runTask(task)">run now</button>
            <button class="text-xs text-red-400" (click)="removeTask(task)">delete</button>
          </div>
        }
        <form class="mt-3 flex flex-wrap gap-2" [formGroup]="taskForm" (ngSubmit)="addTask()">
          <input class="input flex-1" placeholder="name" formControlName="name" />
          <input class="input flex-1" placeholder="command" formControlName="command" />
          <input class="input w-40" placeholder="cron (e.g. 0 * * * *)" formControlName="frequency" />
          <button class="button" type="submit" [disabled]="taskForm.invalid">Add task</button>
        </form>
      </section>

      <!-- Volumes -->
      <section class="box mb-6">
        <h2 class="mb-3 font-semibold">Persistent volumes</h2>
        @for (vol of volumes()?.persistent ?? []; track vol.id) {
          <div class="mb-1 text-sm">
            <code>{{ vol.name }}</code> → {{ vol.mount_path }}
          </div>
        }
        <form class="mt-3 flex flex-wrap gap-2" [formGroup]="volumeForm" (ngSubmit)="addVolume()">
          <input class="input flex-1" placeholder="name" formControlName="name" />
          <input class="input flex-1" placeholder="/mount/path" formControlName="mount_path" />
          <button class="button" type="submit" [disabled]="volumeForm.invalid">Add volume</button>
        </form>
      </section>

      <!-- Ops -->
      <section class="box mb-6">
        <h2 class="mb-3 font-semibold">Operations</h2>
        <div class="mb-2 flex gap-2">
          <button class="button-secondary" (click)="refreshStatus()">Status</button>
          <button class="button-secondary" (click)="refreshMetrics()">Metrics</button>
        </div>
        @if (opsOutput()) {
          <pre class="overflow-auto whitespace-pre-wrap font-mono text-xs">{{ opsOutput() }}</pre>
        }
        <form class="mt-3 flex gap-2" [formGroup]="execForm" (ngSubmit)="runExec()">
          <input class="input flex-1" placeholder="command to run in container" formControlName="command" />
          <button class="button" type="submit" [disabled]="execForm.invalid">Exec</button>
        </form>
      </section>

      <!-- Firewall (WAF) -->
      <section class="box mb-6">
        <h2 class="mb-3 font-semibold">Firewall (WAF)</h2>
        @if (firewall(); as fw) {
          <label class="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" [checked]="fw.enabled" (change)="toggleFirewall(fw)" />
            Enabled · {{ fw.total_blocked }} blocked / {{ fw.total_requests }} requests
          </label>
          @for (rule of firewallRules(); track rule.id) {
            <div class="mb-1 flex items-center gap-3 text-sm">
              <span class="font-semibold">{{ rule.name }}</span>
              <span style="color: var(--color-text-secondary)">{{ rule.action }} (p{{ rule.priority }})</span>
              <button class="ml-auto text-xs text-red-400" (click)="removeRule(rule)">delete</button>
            </div>
          }
          <form class="mt-3 flex flex-wrap gap-2" [formGroup]="ruleForm" (ngSubmit)="addRule()">
            <input class="input flex-1" placeholder="rule name" formControlName="name" />
            <input class="input flex-1" placeholder='conditions JSON e.g. [{"field":"uri","operator":"contains","value":"/admin"}]' formControlName="conditions" />
            <button class="button" type="submit" [disabled]="ruleForm.invalid">Add rule</button>
          </form>
          <button class="button-secondary mt-3" (click)="deployFirewall()">Deploy firewall</button>
        }
      </section>

      <!-- Pipeline (CI/CD) -->
      <section class="box mb-6">
        <h2 class="mb-3 font-semibold">CI/CD Pipeline</h2>
        @if (pipeline(); as p) {
          <div class="mb-2 text-sm" style="color: var(--color-text-secondary)">
            Stages: {{ p.stages.join(' → ') }} · {{ p.enabled ? 'enabled' : 'disabled' }}
          </div>
        }
        <button class="button" (click)="runPipeline()">Run pipeline</button>
        <div class="mt-3 space-y-1">
          @for (ex of pipelineExecutions(); track $index) {
            <div class="text-sm">
              <span class="font-mono">{{ ex['branch'] }}</span> — {{ ex['status'] }}
            </div>
          }
        </div>
      </section>

      <!-- Deployments / rollback -->
      <section class="box">
        <h2 class="mb-3 font-semibold">Deployment history</h2>
        @if (deployments().length === 0) {
          <p class="text-sm" style="color: var(--color-text-secondary)">No deployments yet.</p>
        } @else {
          <div class="space-y-2">
            @for (dep of deployments(); track dep.deployment_uuid) {
              <div class="flex items-center gap-3 text-sm">
                <span class="font-mono">{{ dep.commit }}</span>
                <span>{{ dep.status }}</span>
                <button class="ml-auto text-xs" (click)="rollback(dep)">Redeploy this commit</button>
              </div>
            }
          </div>
        }
      </section>
    } @else {
      <p class="text-sm" style="color: var(--color-text-secondary)">Loading…</p>
    }
  `,
})
export class ApplicationDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  protected readonly app = signal<Application | null>(null);
  protected readonly envVars = signal<EnvVar[]>([]);
  protected readonly deployments = signal<DeploymentHistoryItem[]>([]);
  protected readonly tasks = signal<ScheduledTask[]>([]);
  protected readonly volumes = signal<AppVolumes | null>(null);
  protected readonly opsOutput = signal<string>('');
  protected readonly firewall = signal<FirewallConfig | null>(null);
  protected readonly firewallRules = signal<FirewallRule[]>([]);
  protected readonly pipeline = signal<{ enabled: boolean; stages: string[]; trigger_mode: string } | null>(null);
  protected readonly pipelineExecutions = signal<Record<string, unknown>[]>([]);
  protected readonly savingConfig = signal(false);

  private uuid = '';

  protected readonly configForm = this.fb.nonNullable.group({
    git_repository: [''],
    git_branch: [''],
    build_pack: [''],
    fqdn: [''],
  });

  protected readonly envForm = this.fb.nonNullable.group({
    key: ['', Validators.required],
    value: ['', Validators.required],
  });

  protected readonly taskForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    command: ['', Validators.required],
    frequency: ['', Validators.required],
  });

  protected readonly volumeForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    mount_path: ['', Validators.required],
  });

  protected readonly execForm = this.fb.nonNullable.group({
    command: ['', Validators.required],
  });

  protected readonly ruleForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    conditions: ['[]', Validators.required],
  });

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.reload();
  }

  private reload(): void {
    this.api.getApplication(this.uuid).subscribe((a) => {
      this.app.set(a);
      this.configForm.patchValue({
        git_repository: a.git_repository ?? '',
        git_branch: a.git_branch ?? '',
        build_pack: a.build_pack ?? '',
      });
    });
    this.api.listEnvVars(this.uuid).subscribe((v) => this.envVars.set(v));
    this.api.listDeployments(this.uuid).subscribe((d) => this.deployments.set(d));
    this.api.listTasks(this.uuid).subscribe((t) => this.tasks.set(t));
    this.api.listVolumes(this.uuid).subscribe((v) => this.volumes.set(v));
    this.api.getFirewall(this.uuid).subscribe((f) => this.firewall.set(f));
    this.api.listFirewallRules(this.uuid).subscribe((r) => this.firewallRules.set(r));
    this.api.getPipeline(this.uuid).subscribe((p) => this.pipeline.set(p));
    this.api.listPipelineExecutions(this.uuid).subscribe((e) => this.pipelineExecutions.set(e));
  }

  protected saveConfig(): void {
    this.savingConfig.set(true);
    this.api.updateApplication(this.uuid, this.configForm.getRawValue()).subscribe({
      next: (a) => {
        this.app.set(a);
        this.savingConfig.set(false);
      },
      error: () => this.savingConfig.set(false),
    });
  }

  protected addEnv(): void {
    if (this.envForm.invalid) return;
    this.api.upsertEnvVar(this.uuid, this.envForm.getRawValue()).subscribe(() => {
      this.envForm.reset();
      this.api.listEnvVars(this.uuid).subscribe((v) => this.envVars.set(v));
    });
  }

  protected removeEnv(env: EnvVar): void {
    this.api.deleteEnvVar(this.uuid, env.key).subscribe(() => {
      this.envVars.update((list) => list.filter((e) => e.key !== env.key));
    });
  }

  protected lifecycle(action: 'start' | 'stop' | 'restart'): void {
    this.api.appLifecycle(this.uuid, action).subscribe(() => this.reload());
  }

  protected deploy(): void {
    this.api.deploy(this.uuid).subscribe((res) =>
      this.router.navigate(['/deployments', res.deploymentUuid])
    );
  }

  protected rollback(dep: DeploymentHistoryItem): void {
    this.api.deploy(this.uuid, dep.commit).subscribe((res) =>
      this.router.navigate(['/deployments', res.deploymentUuid])
    );
  }

  protected addTask(): void {
    if (this.taskForm.invalid) return;
    this.api.createTask(this.uuid, this.taskForm.getRawValue()).subscribe(() => {
      this.taskForm.reset();
      this.api.listTasks(this.uuid).subscribe((t) => this.tasks.set(t));
    });
  }

  protected runTask(task: ScheduledTask): void {
    this.api.runTask(this.uuid, task.uuid).subscribe();
  }

  protected removeTask(task: ScheduledTask): void {
    this.api.deleteTask(this.uuid, task.uuid).subscribe(() => {
      this.tasks.update((list) => list.filter((t) => t.uuid !== task.uuid));
    });
  }

  protected addVolume(): void {
    if (this.volumeForm.invalid) return;
    this.api.createPersistentVolume(this.uuid, this.volumeForm.getRawValue()).subscribe(() => {
      this.volumeForm.reset();
      this.api.listVolumes(this.uuid).subscribe((v) => this.volumes.set(v));
    });
  }

  protected refreshStatus(): void {
    this.api.appStatus(this.uuid).subscribe((s) => this.opsOutput.set(s.status));
  }

  protected refreshMetrics(): void {
    this.api.appMetrics(this.uuid).subscribe((m) => this.opsOutput.set(m.metrics));
  }

  protected runExec(): void {
    if (this.execForm.invalid) return;
    this.api.appExec(this.uuid, this.execForm.getRawValue().command).subscribe((r) => {
      this.opsOutput.set(r.output);
    });
  }

  protected toggleFirewall(fw: FirewallConfig): void {
    this.api.updateFirewall(this.uuid, { enabled: !fw.enabled }).subscribe((f) => this.firewall.set(f));
  }

  protected addRule(): void {
    if (this.ruleForm.invalid) return;
    const raw = this.ruleForm.getRawValue();
    let conditions: unknown[];
    try {
      conditions = JSON.parse(raw.conditions);
    } catch {
      conditions = [];
    }
    this.api.createFirewallRule(this.uuid, { name: raw.name, conditions }).subscribe(() => {
      this.ruleForm.reset({ name: '', conditions: '[]' });
      this.api.listFirewallRules(this.uuid).subscribe((r) => this.firewallRules.set(r));
    });
  }

  protected removeRule(rule: FirewallRule): void {
    this.api.deleteFirewallRule(this.uuid, rule.id).subscribe(() => {
      this.firewallRules.update((list) => list.filter((r) => r.id !== rule.id));
    });
  }

  protected deployFirewall(): void {
    this.api.deployFirewall(this.uuid).subscribe();
  }

  protected runPipeline(): void {
    this.api.triggerPipeline(this.uuid).subscribe(() => {
      this.api.listPipelineExecutions(this.uuid).subscribe((e) => this.pipelineExecutions.set(e));
    });
  }
}
