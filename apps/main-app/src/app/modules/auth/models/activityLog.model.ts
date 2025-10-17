export interface ActivityLogModel {
    id?: string; // ID généré par Firestore
    userId: string; // ID de l'utilisateur
    action: string; // Action effectuée (ex: "Création de projet")
    details?: string; // Détails supplémentaires
    timestamp: Date; // Date et heure de l'action
  }