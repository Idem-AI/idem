<?php

namespace Idem\SharedAuth\Models;

use DateTime;

/**
 * Modèle utilisateur avec système d'autorisation
 * Basé sur shared-models/src/auth/user.model.ts
 */
class UserModel
{
    public ?string $id = null;
    public string $uid;
    public string $email;
    public ?string $displayName = null;
    public ?string $photoURL = null;
    public string $subscription = 'free'; // 'free' | 'pro' | 'enterprise'
    public DateTime $createdAt;
    public DateTime $lastLogin;
    public QuotaData $quota;

    // Authentification
    public string $authProvider = 'email'; // 'google' | 'github' | 'email'
    public ?GitHubIntegration $githubIntegration = null;
    public ?GoogleIntegration $googleIntegration = null;
    /** @var RefreshTokenData[] */
    public array $refreshTokens = [];
    public ?PolicyAcceptanceStatus $policyAcceptance = null;

    // Système d'autorisation
    public bool $isOwner = false;
    public ?string $createdBy = null;
    /** @var string[] */
    public array $teamMemberships = [];

    // Statut
    public bool $isActive = true;
    public bool $isEmailVerified = false;
    public ?DateTime $lastPasswordChange = null;

    // Métadonnées
    public DateTime $updatedAt;

    public function __construct(array $data = [])
    {
        $this->createdAt = new DateTime();
        $this->updatedAt = new DateTime();
        $this->lastLogin = new DateTime();
        $this->quota = new QuotaData();

        foreach ($data as $key => $value) {
            if (property_exists($this, $key)) {
                $this->$key = $value;
            }
        }
    }

    /**
     * Convertir en tableau
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'uid' => $this->uid,
            'email' => $this->email,
            'displayName' => $this->displayName,
            'photoURL' => $this->photoURL,
            'subscription' => $this->subscription,
            'createdAt' => $this->createdAt->format('c'),
            'lastLogin' => $this->lastLogin->format('c'),
            'quota' => $this->quota->toArray(),
            'authProvider' => $this->authProvider,
            'isOwner' => $this->isOwner,
            'createdBy' => $this->createdBy,
            'teamMemberships' => $this->teamMemberships,
            'isActive' => $this->isActive,
            'isEmailVerified' => $this->isEmailVerified,
            'updatedAt' => $this->updatedAt->format('c'),
        ];
    }

    /**
     * Créer depuis un tableau
     */
    public static function fromArray(array $data): self
    {
        $user = new self();
        
        $user->id = $data['id'] ?? null;
        $user->uid = $data['uid'];
        $user->email = $data['email'];
        $user->displayName = $data['displayName'] ?? null;
        $user->photoURL = $data['photoURL'] ?? null;
        $user->subscription = $data['subscription'] ?? 'free';
        
        if (isset($data['createdAt'])) {
            $user->createdAt = new DateTime($data['createdAt']);
        }
        
        if (isset($data['lastLogin'])) {
            $user->lastLogin = new DateTime($data['lastLogin']);
        }
        
        if (isset($data['quota'])) {
            $user->quota = QuotaData::fromArray($data['quota']);
        }
        
        $user->authProvider = $data['authProvider'] ?? 'email';
        $user->isOwner = $data['isOwner'] ?? false;
        $user->createdBy = $data['createdBy'] ?? null;
        $user->teamMemberships = $data['teamMemberships'] ?? [];
        $user->isActive = $data['isActive'] ?? true;
        $user->isEmailVerified = $data['isEmailVerified'] ?? false;
        
        if (isset($data['updatedAt'])) {
            $user->updatedAt = new DateTime($data['updatedAt']);
        }
        
        return $user;
    }
}

/**
 * Données de quota utilisateur
 */
class QuotaData
{
    public int $dailyUsage = 0;
    public int $weeklyUsage = 0;
    public int $dailyLimit = 0;
    public int $weeklyLimit = 0;
    public string $lastResetDaily;
    public string $lastResetWeekly;
    public ?DateTime $quotaUpdatedAt = null;

    public function __construct()
    {
        $this->lastResetDaily = date('Y-m-d');
        $this->lastResetWeekly = date('Y-m-d');
    }

    public function toArray(): array
    {
        return [
            'dailyUsage' => $this->dailyUsage,
            'weeklyUsage' => $this->weeklyUsage,
            'dailyLimit' => $this->dailyLimit,
            'weeklyLimit' => $this->weeklyLimit,
            'lastResetDaily' => $this->lastResetDaily,
            'lastResetWeekly' => $this->lastResetWeekly,
            'quotaUpdatedAt' => $this->quotaUpdatedAt?->format('c'),
        ];
    }

    public static function fromArray(array $data): self
    {
        $quota = new self();
        $quota->dailyUsage = $data['dailyUsage'] ?? 0;
        $quota->weeklyUsage = $data['weeklyUsage'] ?? 0;
        $quota->dailyLimit = $data['dailyLimit'] ?? 0;
        $quota->weeklyLimit = $data['weeklyLimit'] ?? 0;
        $quota->lastResetDaily = $data['lastResetDaily'] ?? date('Y-m-d');
        $quota->lastResetWeekly = $data['lastResetWeekly'] ?? date('Y-m-d');
        
        if (isset($data['quotaUpdatedAt'])) {
            $quota->quotaUpdatedAt = new DateTime($data['quotaUpdatedAt']);
        }
        
        return $quota;
    }
}

/**
 * Intégration GitHub
 */
class GitHubIntegration
{
    public string $accessToken;
    public ?string $refreshToken = null;
    public string $username;
    public ?string $avatarUrl = null;
    public DateTime $connectedAt;
    public ?DateTime $lastUsed = null;
    /** @var string[] */
    public array $scopes = [];

    public function toArray(): array
    {
        return [
            'accessToken' => $this->accessToken,
            'refreshToken' => $this->refreshToken,
            'username' => $this->username,
            'avatarUrl' => $this->avatarUrl,
            'connectedAt' => $this->connectedAt->format('c'),
            'lastUsed' => $this->lastUsed?->format('c'),
            'scopes' => $this->scopes,
        ];
    }
}

/**
 * Intégration Google
 */
class GoogleIntegration
{
    public string $accessToken;
    public ?string $refreshToken = null;
    public string $email;
    public ?string $avatarUrl = null;
    public DateTime $connectedAt;
    public ?DateTime $lastUsed = null;
    /** @var string[] */
    public array $scopes = [];

    public function toArray(): array
    {
        return [
            'accessToken' => $this->accessToken,
            'refreshToken' => $this->refreshToken,
            'email' => $this->email,
            'avatarUrl' => $this->avatarUrl,
            'connectedAt' => $this->connectedAt->format('c'),
            'lastUsed' => $this->lastUsed?->format('c'),
            'scopes' => $this->scopes,
        ];
    }
}

/**
 * Données de refresh token
 */
class RefreshTokenData
{
    public string $token;
    public DateTime $expiresAt;
    public DateTime $createdAt;
    public ?DateTime $lastUsed = null;
    public ?string $deviceInfo = null;
    public ?string $ipAddress = null;

    public function toArray(): array
    {
        return [
            'token' => $this->token,
            'expiresAt' => $this->expiresAt->format('c'),
            'createdAt' => $this->createdAt->format('c'),
            'lastUsed' => $this->lastUsed?->format('c'),
            'deviceInfo' => $this->deviceInfo,
            'ipAddress' => $this->ipAddress,
        ];
    }
}

/**
 * Statut d'acceptation des politiques
 */
class PolicyAcceptanceStatus
{
    public bool $privacyPolicy = false;
    public bool $termsOfService = false;
    public bool $betaPolicy = false;
    public ?bool $marketingAcceptance = null;
    public ?DateTime $lastAcceptedAt = null;
    public ?string $ipAddress = null;
    public ?string $userAgent = null;

    public function toArray(): array
    {
        return [
            'privacyPolicy' => $this->privacyPolicy,
            'termsOfService' => $this->termsOfService,
            'betaPolicy' => $this->betaPolicy,
            'marketingAcceptance' => $this->marketingAcceptance,
            'lastAcceptedAt' => $this->lastAcceptedAt?->format('c'),
            'ipAddress' => $this->ipAddress,
            'userAgent' => $this->userAgent,
        ];
    }
}
