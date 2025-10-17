import { Directive, Input, inject, ElementRef, Renderer2, OnInit, effect } from '@angular/core';
import { QuotaService } from '../services/quota.service';

@Directive({
  selector: '[appBetaFeature]',
  standalone: true
})
export class BetaFeatureDirective implements OnInit {
  @Input('appBetaFeature') featureName: string = '';
  @Input() betaHideMode: 'hide' | 'disable' | 'opacity' = 'disable';
  @Input() betaShowMessage: boolean = true;

  private readonly quotaService = inject(QuotaService);
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  private originalElement: HTMLElement;
  private placeholderElement: HTMLElement | null = null;

  constructor() {
    this.originalElement = this.elementRef.nativeElement;

    // Effect pour réagir aux changements d'état bêta
    effect(() => {
      this.updateElementState();
    });
  }

  ngOnInit(): void {
    if (!this.featureName) {
      console.warn('BetaFeatureDirective: featureName is required');
      return;
    }

    this.updateElementState();
  }

  private updateElementState(): void {
    const isBeta = this.quotaService.isBeta();
    const isFeatureAllowed = this.quotaService.isFeatureAllowedInBeta(this.featureName);

    if (isBeta && !isFeatureAllowed) {
      this.applyBetaRestriction();
    } else {
      this.removeBetaRestriction();
    }
  }

  private applyBetaRestriction(): void {
    switch (this.betaHideMode) {
      case 'hide':
        this.hideElement();
        break;
      case 'disable':
        this.disableElement();
        break;
      case 'opacity':
        this.applyOpacityEffect();
        break;
    }
  }

  private removeBetaRestriction(): void {
    // Restaurer l'élément à son état original
    this.restoreElement();
  }

  private hideElement(): void {
    if (this.placeholderElement) return; // Déjà caché

    // Créer un placeholder si on veut montrer un message
    if (this.betaShowMessage) {
      this.placeholderElement = this.renderer.createElement('div');
      this.renderer.addClass(this.placeholderElement, 'beta-feature-placeholder');
      this.renderer.setStyle(this.placeholderElement, 'padding', '8px');
      this.renderer.setStyle(this.placeholderElement, 'margin', '4px');
      this.renderer.setStyle(this.placeholderElement, 'background-color', 'rgba(249, 115, 22, 0.1)');
      this.renderer.setStyle(this.placeholderElement, 'border', '1px dashed rgba(249, 115, 22, 0.3)');
      this.renderer.setStyle(this.placeholderElement, 'border-radius', '6px');
      this.renderer.setStyle(this.placeholderElement, 'text-align', 'center');
      this.renderer.setStyle(this.placeholderElement, 'color', 'rgba(249, 115, 22, 0.8)');
      this.renderer.setStyle(this.placeholderElement, 'font-size', '12px');

      const message = this.renderer.createText('🚧 Fonctionnalité non disponible en version bêta');
      this.renderer.appendChild(this.placeholderElement, message);

      // Insérer le placeholder avant l'élément original
      const parent = this.originalElement.parentNode;
      if (parent) {
        this.renderer.insertBefore(parent, this.placeholderElement, this.originalElement);
      }
    }

    // Cacher l'élément original
    this.renderer.setStyle(this.originalElement, 'display', 'none');
  }

  private disableElement(): void {
    // Désactiver l'élément
    this.renderer.setAttribute(this.originalElement, 'disabled', 'true');
    this.renderer.setStyle(this.originalElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.originalElement, 'opacity', '0.5');
    this.renderer.setStyle(this.originalElement, 'cursor', 'not-allowed');

    // Ajouter une classe pour le styling
    this.renderer.addClass(this.originalElement, 'beta-disabled');

    // Ajouter un tooltip explicatif si demandé
    if (this.betaShowMessage) {
      this.renderer.setAttribute(this.originalElement, 'title', 
        'Cette fonctionnalité n\'est pas disponible en version bêta');
    }
  }

  private applyOpacityEffect(): void {
    this.renderer.setStyle(this.originalElement, 'opacity', '0.3');
    this.renderer.setStyle(this.originalElement, 'pointer-events', 'none');
    this.renderer.addClass(this.originalElement, 'beta-opacity');

    if (this.betaShowMessage) {
      this.renderer.setAttribute(this.originalElement, 'title', 
        'Cette fonctionnalité n\'est pas disponible en version bêta');
    }
  }

  private restoreElement(): void {
    // Supprimer le placeholder s'il existe
    if (this.placeholderElement) {
      const parent = this.placeholderElement.parentNode;
      if (parent) {
        this.renderer.removeChild(parent, this.placeholderElement);
      }
      this.placeholderElement = null;
    }

    // Restaurer l'élément original
    this.renderer.removeStyle(this.originalElement, 'display');
    this.renderer.removeAttribute(this.originalElement, 'disabled');
    this.renderer.removeStyle(this.originalElement, 'pointer-events');
    this.renderer.removeStyle(this.originalElement, 'opacity');
    this.renderer.removeStyle(this.originalElement, 'cursor');
    this.renderer.removeAttribute(this.originalElement, 'title');
    
    // Supprimer les classes ajoutées
    this.renderer.removeClass(this.originalElement, 'beta-disabled');
    this.renderer.removeClass(this.originalElement, 'beta-opacity');
  }
}
