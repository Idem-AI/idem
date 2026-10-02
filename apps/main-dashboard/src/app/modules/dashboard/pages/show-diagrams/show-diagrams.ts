import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { environment } from '../../../../../environments/environment';
import { CookieService } from '../../../../shared/services/cookie.service';
import { ErrorStateComponent } from '../../../../shared/components/error-state/error-state';
import { generatePdf } from '../../../../utils/pdf-generator';
import { DiagramsService } from '../../services/ai-agents/diagrams.service';
import { SectionModel } from '../../models/section.model';
import { SiteAppIllustrationComponent } from '../development/site-app-illustration';

/**
 * Le plan de l'application (diagrammes), première étape d'une application
 * complète dans « Site et app ».
 *
 * Il n'a plus d'entrée propre dans la barre latérale : un plan ne sert qu'à
 * construire l'application, c'est donc là qu'on le dessine et qu'on le relit,
 * avec l'étape suivante — la construction dans iCode — à portée de main.
 */
@Component({
  selector: 'app-show-diagrams',
  imports: [
    RouterLink,
    MarkdownModule,
    TranslateModule,
    IdemLoaderComponent,
    ErrorStateComponent,
    SiteAppIllustrationComponent,
  ],
  templateUrl: './show-diagrams.html',
  styleUrls: ['./show-diagrams.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowDiagramsComponent implements OnInit {
  private readonly diagramsService = inject(DiagramsService);
  private readonly cookies = inject(CookieService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly diagenUrl = environment.services.diagen.url;
  private readonly webgenUrl = environment.services.webgen.url;

  protected readonly projectId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly sections = signal<SectionModel[]>([]);

  ngOnInit(): void {
    const projectId = this.cookies.get('projectId');
    this.projectId.set(projectId);
    if (!projectId) {
      void this.router.navigate(['/projects']);
      return;
    }
    this.load(projectId);
  }

  protected retry(): void {
    const projectId = this.projectId();
    if (projectId) this.load(projectId);
  }

  private load(projectId: string): void {
    this.loading.set(true);
    this.failed.set(false);

    this.diagramsService
      .getDiagram(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (diagram) => {
          // Le schéma est enregistré sans sa clôture Markdown : on la remet
          // pour que le rendu Mermaid le reconnaisse.
          this.sections.set(
            (diagram?.sections ?? []).map((section) => ({
              ...section,
              data: section.data ? `\`\`\`${section.data}\n\`\`\`` : section.data,
            })),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }

  protected downloadPdf(): void {
    const content = this.sections()
      .map((section) => section.data || '')
      .join('\n');
    if (content) generatePdf(content);
  }

  /** L'éditeur de schémas, dans un nouvel onglet. */
  protected openEditor(): void {
    const projectId = this.projectId();
    if (projectId) window.open(`${this.diagenUrl}/edit/${projectId}`, '_blank', 'noopener');
  }

  /** Étape suivante : iCode bâtit l'application sur ce plan. */
  protected buildApp(): void {
    const projectId = this.projectId();
    if (projectId) {
      window.location.href = `${this.webgenUrl}?projectId=${encodeURIComponent(projectId)}&product=app`;
    }
  }
}
