import { ChangeDetectionStrategy, Component, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { DiagramModel } from '../../../../models/diagram.model';
import { generatePdf } from '../../../../../../utils/pdf-generator';
import { environment } from '../../../../../../../environments/environment';
import { CookieService } from '../../../../../../shared/services/cookie.service';

@Component({
  selector: 'app-diagram-display',
  standalone: true,
  imports: [CommonModule, MarkdownModule],
  templateUrl: './diagram-display.html',
  styleUrls: ['./diagram-display.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagramDisplay {
  // Input signal for the diagram data
  readonly diagram = input.required<DiagramModel>();
  readonly cookieService = inject(CookieService);
  readonly projectId = signal<string | null>(null);
  // Environment URL for external services
  protected readonly diagenUrl = environment.services.diagen.url;

  ngOnInit(): void {
    // Get project ID from cookies
    const projectId = this.cookieService.get('projectId');
    this.projectId.set(projectId);
  }

  /**
   * Generate PDF from current diagram
   */
  protected makePdf(): void {
    const diagramData = this.diagram();
    if (diagramData && diagramData.content) {
      generatePdf(diagramData.content);
    } else if (diagramData && diagramData.sections) {
      const diagramContent = diagramData.sections
        .map((section: any) => section.data || '')
        .join('\n');
      generatePdf(diagramContent);
    }
  }

  /**
   * Open external diagram editor (chart service) in a new window/tab
   */
  protected openEditor(): void {
    const url = `${this.diagenUrl}/edit/${this.projectId()}` || '';
    try {
      // Optionally, we could pass current content via query/hash later
      window.open(url, 'noopener,noreferrer');
    } catch {
      // Fallback to same-tab navigation if popup blocked
      window.location.href = url;
    }
  }

  /**
   * Trigger generation of new diagrams
   */
  protected generateNewDiagrams(): void {
    // Emit event to parent component to handle new generation
    window.location.reload(); // Simple approach - reload to trigger new generation
  }
}
