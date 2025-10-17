// import { Directive, Input, HostListener, inject, ElementRef, Renderer2 } from '@angular/core';
// import { QuotaService } from '../services/quota.service';
// import { NotificationService } from '../services/notification.service';
// import { first } from 'rxjs/operators';

// @Directive({
//   selector: '[appQuotaCheck]',
//   standalone: true
// })
// export class QuotaCheckDirective {
//   @Input('appQuotaCheck') featureName: string = '';
//   @Input() quotaCheckDisabled: boolean = false;

//   private readonly quotaService = inject(QuotaService);
//   private readonly notificationService = inject(NotificationService);
//   private readonly elementRef = inject(ElementRef);
//   private readonly renderer = inject(Renderer2);

//   @HostListener('click', ['$event'])
//   onElementClick(event: Event): void {
//     if (this.quotaCheckDisabled) {
//       return; // Bypass quota check if disabled
//     }

//     if (!this.featureName) {
//       console.warn('QuotaCheckDirective: featureName is required');
//       return;
//     }

//     // Prevent the default action initially
//     event.preventDefault();
//     event.stopPropagation();

//     // Check quota before allowing the action
//     this.checkQuotaAndProceed(event);
//   }

//   private checkQuotaAndProceed(originalEvent: Event): void {
//     const quotaDisplay = this.quotaService.quotaDisplay();
    
//     // Check if quota is available
//     if (!quotaDisplay?.canUseFeature) {
//       this.showQuotaExceededMessage();
//       return;
//     }

//     // Check if feature is allowed in beta
//     if (!this.quotaService.isFeatureAllowedInBeta(this.featureName)) {
//       this.showBetaRestrictionMessage();
//       return;
//     }

//     // Validate feature with backend
//     this.quotaService.validateFeature(this.featureName)
//       .pipe(first())
//       .subscribe({
//         next: (validation) => {
//           if (validation.allowed) {
//             // Quota OK, proceed with original action
//             this.proceedWithOriginalAction(originalEvent);
//           } else {
//             this.showValidationErrorMessage(validation.message);
//           }
//         },
//         error: (error) => {
//           console.error('Error validating feature:', error);
//           // In case of error, show a generic message but allow the action
//           this.notificationService.showWarning({
//             title: 'Vérification impossible',
//             message: 'Impossible de vérifier les quotas. L\'action sera tentée.',
//             duration: 3000
//           });
//           this.proceedWithOriginalAction(originalEvent);
//         }
//       });
//   }

//   private proceedWithOriginalAction(originalEvent: Event): void {
//     // Create a new event to trigger the original action
//     const newEvent = new Event(originalEvent.type, {
//       bubbles: originalEvent.bubbles,
//       cancelable: originalEvent.cancelable
//     });

//     // Temporarily disable quota check to avoid infinite loop
//     this.quotaCheckDisabled = true;
    
//     // Dispatch the new event
//     this.elementRef.nativeElement.dispatchEvent(newEvent);
    
//     // Re-enable quota check after a short delay
//     setTimeout(() => {
//       this.quotaCheckDisabled = false;
//     }, 100);
//   }

//   private showQuotaExceededMessage(): void {
//     const quotaInfo = this.quotaService.quotaInfo();
//     const message = quotaInfo 
//       ? `Quota dépassé. Quotidien: ${quotaInfo.remainingDaily}/${quotaInfo.dailyLimit}, Hebdomadaire: ${quotaInfo.remainingWeekly}/${quotaInfo.weeklyLimit}`
//       : 'Quota dépassé. Veuillez attendre avant de réessayer.';

//     this.notificationService.showError({
//       title: 'Quota dépassé',
//       message,
//       duration: 5000,
//       actions: [
//         {
//           label: 'Rafraîchir',
//           action: () => this.quotaService.refreshQuotaInfo().subscribe()
//         }
//       ]
//     });
//   }

//   private showBetaRestrictionMessage(): void {
//     const message = this.quotaService.getBetaRestrictionMessage(this.featureName);
    
//     this.notificationService.showWarning({
//       title: 'Fonctionnalité limitée',
//       message: message || 'Cette fonctionnalité n\'est pas disponible en version bêta.',
//       duration: 4000
//     });
//   }

//   private showValidationErrorMessage(message?: string): void {
//     this.notificationService.showError({
//       title: 'Action non autorisée',
//       message: message || 'Cette action n\'est pas autorisée actuellement.',
//       duration: 4000
//     });
//   }

//   /**
//    * Méthode publique pour vérifier manuellement les quotas
//    */
//   public checkQuota(): Promise<boolean> {
//     return new Promise((resolve) => {
//       const quotaDisplay = this.quotaService.quotaDisplay();
      
//       if (!quotaDisplay?.canUseFeature) {
//         resolve(false);
//         return;
//       }

//       if (!this.quotaService.isFeatureAllowedInBeta(this.featureName)) {
//         resolve(false);
//         return;
//       }

//       this.quotaService.validateFeature(this.featureName)
//         .pipe(first())
//         .subscribe({
//           next: (validation) => resolve(validation.allowed),
//           error: () => resolve(true) // En cas d'erreur, on autorise l'action
//         });
//     });
//   }
// }
