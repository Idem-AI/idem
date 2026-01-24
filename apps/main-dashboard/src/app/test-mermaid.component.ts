import { Component } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-test-mermaid',
  standalone: true,
  imports: [MarkdownModule],
  template: `
    <div class="p-4">
      <h2>Mermaid Test</h2>
      <markdown mermaid>
        \`\`\`mermaid
        graph TD
          A[Start] --> B{Is it working?}
          B -->|Yes| C[Great!]
          B -->|No| D[Fix it]
          D --> B
        \`\`\`
      </markdown>
    </div>
  `
})
export class TestMermaidComponent {}
