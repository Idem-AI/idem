<?php

namespace App\Contracts;

/**
 * Interface pour les fournisseurs IA
 * Permet de brancher n'importe quelle IA (Gemini, OpenAI, Claude, etc.)
 */
interface AIProviderInterface
{
    /**
     * Analyse générique avec prompt personnalisé
     *
     * @param array $params Paramètres incluant 'prompt' et autres options
     * @return array Résultat de l'analyse
     */
    public function analyze(array $params): array;

    /**
     * Analyser un repository et générer un plan de déploiement
     *
     * @param array $context Context du repository (fichiers, structure, etc.)
     * @return array Plan de déploiement
     */
    public function analyzeRepository(array $context): array;

    /**
     * Diagnostiquer une erreur de déploiement
     *
     * @param string $logs Logs d'erreur
     * @param array $context Contexte de l'application
     * @return array Solution suggérée
     */
    public function diagnoseError(string $logs, array $context): array;

    /**
     * Générer une configuration optimale
     *
     * @param array $application Données de l'application
     * @return array Configuration recommandée
     */
    public function optimizeConfiguration(array $application): array;

    /**
     * Vérifier la disponibilité du provider
     *
     * @return bool
     */
    public function isAvailable(): bool;

    /**
     * Obtenir le nom du provider
     *
     * @return string
     */
    public function getName(): string;
}
