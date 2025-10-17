export interface SubscriptionModel {
    id?: string; // ID généré par Firestore
    userId: string; // ID de l'utilisateur
    plan: 'free' | 'pro' | 'enterprise'; // Plan d'abonnement
    startDate: Date; // Date de début de l'abonnement
    endDate: Date; // Date de fin de l'abonnement
    status: 'active' | 'expired' | 'cancelled'; // Statut de l'abonnement
  }