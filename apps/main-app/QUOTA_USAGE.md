<!-- Vérification automatique des quotas -->
<button appQuotaCheck="logo-generation" (click)="generateLogo()">
  Générer un logo
</button>

<!-- Avec tooltip informatif -->
<app-quota-tooltip featureName="branding">
  <button appQuotaCheck="branding">Créer une charte</button>
</app-quota-tooltip>

<!-- Masquer en mode bêta -->
<div appBetaFeature="advanced-feature" betaHideMode="hide">
  Fonctionnalité avancée
</div>