import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CookieService } from '../../../../shared/services/cookie.service';
import { DiagramsService } from '../../services/ai-agents/diagrams.service';
import { DiagramModel } from '../../models/diagram.model';
import { DiagramDisplay } from './components/diagram-display/diagram-display';
import { Loader } from '../../../../components/loader/loader';

@Component({
  selector: 'app-show-diagrams',
  standalone: true,
  imports: [CommonModule, DiagramDisplay, Loader],
  templateUrl: './show-diagrams.html',
  styleUrls: ['./show-diagrams.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowDiagramsComponent implements OnInit {
  // Injected services
  private readonly diagramsService = inject(DiagramsService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);

  // Signals for state management
  protected readonly isLoading = signal<boolean>(true);
  protected readonly existingDiagram = signal<DiagramModel | null>(null);
  protected readonly projectIdFromCookie = signal<string | null>(null);

  // Temporary compatibility properties (will be removed after cache clears)
  protected readonly showDisplayComponent = signal<boolean>(false);
  protected readonly showGenerationComponent = signal<boolean>(false);

  ngOnInit(): void {
    // Get project ID from cookies
    const projectId = this.cookieService.get('projectId');
    this.projectIdFromCookie.set(projectId);
    console.log('Project ID from cookies: ', projectId);

    if (projectId) {
      this.loadExistingDiagram(projectId);
    } else {
      this.isLoading.set(false);
    }
  }

  /**
   * Load existing diagram for the project
   */
  private loadExistingDiagram(projectId: string): void {
    this.diagramsService.getDiagram(projectId).subscribe({
      next: (diagram: DiagramModel) => {
        if (diagram) {
          // Get the first diagram
          const diagramData = diagram;

          // Process sections to ensure proper markdown formatting
          if (diagramData.sections) {
            diagramData.sections.forEach((section: any) => {
              section.data = `\`\`\`${section.data}\n\`\`\``;
            });
          }

          // Existing diagram found - show it
          this.existingDiagram.set(diagramData);
        } else {
          // No existing diagram - show generate button (no redirect)
          console.log('No existing diagram found, showing generate button');
          this.existingDiagram.set(null);
        }

        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Error loading diagram:', err);
        // Error loading - show generate button (no redirect)
        console.log('Error loading diagram, showing generate button');
        this.existingDiagram.set(null);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Navigate to diagram generation page
   */
  protected generateDiagrams(): void {
    console.log('Navigating to diagram generation page');
    this.router.navigate(['/console/project/diagrams/generate']);
  }

  /**
   * Navigate to projects page
   */
  protected goToProjects(): void {
    console.log('Navigating to projects page');
    this.router.navigate(['/console/projects']);
  }
}
