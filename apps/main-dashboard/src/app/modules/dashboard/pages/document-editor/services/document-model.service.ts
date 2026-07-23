import { Injectable, signal } from '@angular/core';
import { ChartConfigLite, EditableSection, ElementStyle } from '../models/editor.types';

/**
 * Source de vérité de l'éditeur : la liste des sections (HTML). Toutes les
 * mutations sont appliquées de façon DÉTERMINISTE sur les chaînes HTML via
 * DOMParser, en localisant les nœuds par le MÊME chemin d'index d'enfants
 * qu'utilise le runtime de l'iframe. Le HTML persisté reste ainsi propre (aucun
 * artefact d'éditeur), et un snapshot = un simple tableau de chaînes.
 *
 * Fourni au niveau du composant éditeur (pas `root`) : chaque ouverture repart
 * d'un état neuf.
 */
@Injectable()
export class DocumentModelService {
  /** Sections courantes (signal = déclencheur de rendu et d'autosave). */
  readonly sections = signal<EditableSection[]>([]);

  private readonly parser = new DOMParser();

  setSections(sections: EditableSection[]): void {
    this.sections.set(sections.map((s) => ({ ...s })));
  }

  snapshot(): EditableSection[] {
    return this.sections().map((s) => ({ ...s }));
  }

  /** Parse le HTML d'une section dans un conteneur dont les enfants = éléments de tête. */
  private parse(html: string): HTMLElement {
    const doc = this.parser.parseFromString(`<div id="__root">${html}</div>`, 'text/html');
    return doc.querySelector('#__root') as HTMLElement;
  }

  private nodeAt(root: HTMLElement, path: string): HTMLElement | null {
    if (path === '') return root;
    let node: Element | null = root;
    for (const part of path.split('.')) {
      if (!node) return null;
      node = node.children[parseInt(part, 10)] ?? null;
    }
    return (node as HTMLElement) ?? null;
  }

  private commit(sectionId: string, root: HTMLElement): void {
    const html = root.innerHTML;
    this.sections.update((list) =>
      list.map((s) => (s.id === sectionId ? { ...s, html } : s)),
    );
  }

  private withSection(sectionId: string, fn: (root: HTMLElement) => void): void {
    const section = this.sections().find((s) => s.id === sectionId);
    if (!section) return;
    const root = this.parse(section.html);
    fn(root);
    this.commit(sectionId, root);
  }

  /** Remplace le contenu texte (innerHTML nettoyé) d'un élément. */
  setText(sectionId: string, path: string, html: string): void {
    this.withSection(sectionId, (root) => {
      const el = this.nodeAt(root, path);
      if (!el) return;
      el.innerHTML = this.cleanEditedHtml(html);
    });
  }

  /** Fusionne un style inline sur un élément (prioritaire sur Tailwind). */
  setStyle(sectionId: string, path: string, style: ElementStyle): void {
    this.withSection(sectionId, (root) => {
      const el = this.nodeAt(root, path);
      if (!el) return;
      (Object.keys(style) as (keyof ElementStyle)[]).forEach((key) => {
        const value = style[key];
        const prop = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
        if (value === '' || value == null) el.style.removeProperty(prop);
        else el.style.setProperty(prop, value);
      });
    });
  }

  /**
   * Déplace un élément parmi ses frères (sémantique de splice de tableau :
   * retirer à `fromIndex`, réinsérer à `toIndex` dans la liste post-suppression).
   */
  reorder(sectionId: string, parentPath: string, fromIndex: number, toIndex: number): void {
    this.withSection(sectionId, (root) => {
      const parent = this.nodeAt(root, parentPath);
      if (!parent) return;
      const child = parent.children[fromIndex];
      if (!child) return;
      parent.removeChild(child);
      const ref = parent.children[toIndex] ?? null;
      parent.insertBefore(child, ref);
    });
  }

  /** Supprime un élément (et son sous-arbre) du document. */
  removeNode(sectionId: string, path: string): void {
    this.withSection(sectionId, (root) => {
      const el = this.nodeAt(root, path);
      if (el && el !== root) el.remove();
    });
  }

  /** Définit (ou met à jour) un attribut HTML arbitraire de l'élément. */
  setAttribute(sectionId: string, path: string, name: string, value: string): void {
    if (!name) return;
    this.withSection(sectionId, (root) => {
      const el = this.nodeAt(root, path);
      if (el) el.setAttribute(name, value);
    });
  }

  /** Retire un attribut HTML de l'élément. */
  removeAttribute(sectionId: string, path: string, name: string): void {
    this.withSection(sectionId, (root) => {
      const el = this.nodeAt(root, path);
      if (el) el.removeAttribute(name);
    });
  }

  /** Remplace intégralement le HTML d'une section (édition IA / restauration). */
  replaceSectionHtml(sectionId: string, html: string): void {
    this.sections.update((list) =>
      list.map((s) => (s.id === sectionId ? { ...s, html } : s)),
    );
  }

  /**
   * Regénère le <script> Chart.js d'un graphique de façon déterministe à partir
   * de la config éditée. Le graphique est identifié par le chemin de son élément
   * (canvas ou conteneur direct). Force animation:false pour le rendu PDF.
   */
  setChart(sectionId: string, path: string, config: ChartConfigLite): void {
    this.withSection(sectionId, (root) => {
      const el = this.nodeAt(root, path);
      if (!el) return;
      const canvas =
        el.tagName === 'CANVAS' ? (el as HTMLCanvasElement) : el.querySelector('canvas');
      if (!canvas) return;

      const canvases = Array.from(root.querySelectorAll('canvas'));
      const canvasIndex = canvases.indexOf(canvas);
      if (!canvas.id) canvas.id = `idem-chart-${sectionId}-${canvasIndex}`;

      const chartConfig = {
        type: config.type,
        data: {
          labels: config.labels,
          datasets: config.datasets.map((d) => ({
            label: d.label,
            data: d.data,
            backgroundColor: d.backgroundColor,
            borderColor: d.borderColor,
          })),
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: !!config.title, text: config.title || '' },
            legend: { display: config.legend !== false },
          },
        },
      };
      const code = `new Chart(document.getElementById(${JSON.stringify(
        canvas.id,
      )}), ${JSON.stringify(chartConfig)});`;

      const scripts = Array.from(root.querySelectorAll('script')).filter((s) =>
        /Chart\s*\(/.test(s.textContent || ''),
      );
      let target = scripts.find((s) => (s.textContent || '').includes(canvas.id));
      if (!target) target = scripts[canvasIndex];

      if (target) {
        target.textContent = code;
      } else {
        const script = root.ownerDocument.createElement('script');
        script.textContent = code;
        canvas.insertAdjacentElement('afterend', script);
      }
    });
  }

  /** Retire les artefacts d'édition d'un innerHTML issu de contentEditable. */
  private cleanEditedHtml(html: string): string {
    const wrapper = this.parse(html);
    wrapper.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    wrapper.querySelectorAll('.idem-editing').forEach((n) => n.classList.remove('idem-editing'));
    return wrapper.innerHTML;
  }
}
