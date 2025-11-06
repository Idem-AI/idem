<?php

namespace Idem\SharedAuth;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Cookie\CookieJar;
use Idem\SharedAuth\Models\UserModel;
use Idem\SharedAuth\Models\TeamModel;
use Idem\SharedAuth\Exceptions\AuthException;
use Psr\Http\Message\ResponseInterface;

/**
 * Client d'authentification pour communiquer avec l'API centrale Idem
 * Équivalent PHP du AuthClient TypeScript
 */
class AuthClient
{
    private Client $httpClient;
    private string $apiBaseUrl;
    private ?string $authToken = null;
    private ?string $cookieHeader = null;
    private CookieJar $cookieJar;

    public function __construct(string $apiBaseUrl, ?string $authToken = null)
    {
        $this->apiBaseUrl = rtrim($apiBaseUrl, '/');
        $this->authToken = $authToken;
        
        // Créer un CookieJar pour gérer les cookies (équivalent de withCredentials: true)
        $this->cookieJar = new CookieJar();
        
        $this->httpClient = new Client([
            'base_uri' => $this->apiBaseUrl,
            'timeout' => 30,
            'headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
            // Équivalent de withCredentials: true
            // Permet d'envoyer et recevoir les cookies automatiquement
            'cookies' => $this->cookieJar,
        ]);
    }

    /**
     * Définir le token d'authentification
     */
    public function setAuthToken(?string $token): void
    {
        $this->authToken = $token;
    }

    /**
     * Obtenir les headers d'authentification
     */
    private function getAuthHeaders(): array
    {
        $headers = [];
        
        if ($this->authToken) {
            $headers['Authorization'] = "Bearer {$this->authToken}";
        }
        
        return $headers;
    }

    /**
     * Définir les cookies depuis une chaîne Cookie header
     */
    public function setCookieHeader(string $cookieHeader): void
    {
        // Les cookies seront envoyés via le header Cookie
        $this->cookieHeader = $cookieHeader;
    }

    /**
     * Injecter des cookies dans le CookieJar
     * Équivalent de withCredentials: true avec cookies pré-existants
     */
    public function injectCookies(array $cookies): void
    {
        $apiUrl = parse_url($this->apiBaseUrl);
        $domain = $apiUrl['host'] ?? 'localhost';
        
        foreach ($cookies as $name => $value) {
            $this->cookieJar->setCookie(new \GuzzleHttp\Cookie\SetCookie([
                'Name' => $name,
                'Value' => $value,
                'Domain' => $domain,
                'Path' => '/',
            ]));
        }
    }

    /**
     * Effectuer une requête HTTP
     */
    private function request(string $method, string $endpoint, array $options = []): array
    {
        try {
            $options['headers'] = array_merge(
                $options['headers'] ?? [],
                $this->getAuthHeaders()
            );

            // Le CookieJar gère automatiquement les cookies (withCredentials: true)
            $response = $this->httpClient->request($method, $endpoint, $options);
            
            return $this->parseResponse($response);
        } catch (GuzzleException $e) {
            throw new AuthException(
                "API request failed: {$e->getMessage()}",
                $e->getCode(),
                $e
            );
        }
    }

    /**
     * Parser la réponse HTTP
     */
    private function parseResponse(ResponseInterface $response): array
    {
        $body = (string) $response->getBody();
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new AuthException('Invalid JSON response from API');
        }
        
        return $data;
    }

    // ============================================
    // USERS
    // ============================================

    /**
     * Obtenir le profil de l'utilisateur courant
     */
    public function getUserProfile(): ?UserModel
    {
        try {
            $data = $this->request('GET', '/auth/profile');
            
            if (isset($data['user'])) {
                return UserModel::fromArray($data['user']);
            }
            
            return null;
        } catch (AuthException $e) {
            if ($e->getCode() === 401 || $e->getCode() === 403) {
                return null;
            }
            throw $e;
        }
    }

    /**
     * Obtenir un utilisateur par son ID
     */
    public function getUserById(string $userId): ?UserModel
    {
        try {
            $data = $this->request('GET', "/users/{$userId}");
            
            if (isset($data['user'])) {
                return UserModel::fromArray($data['user']);
            }
            
            return null;
        } catch (AuthException $e) {
            if ($e->getCode() === 404) {
                return null;
            }
            throw $e;
        }
    }

    // ============================================
    // TEAMS
    // ============================================

    /**
     * Obtenir les teams de l'utilisateur courant
     */
    public function getMyTeams(): array
    {
        $data = $this->request('GET', '/teams/my-teams');
        
        if (!isset($data['teams']) || !is_array($data['teams'])) {
            return [];
        }
        
        return array_map(
            fn($team) => TeamModel::fromArray($team),
            $data['teams']
        );
    }

    /**
     * Obtenir une team par son ID
     */
    public function getTeam(string $teamId): ?TeamModel
    {
        try {
            $data = $this->request('GET', "/teams/{$teamId}");
            
            if (isset($data['team'])) {
                return TeamModel::fromArray($data['team']);
            }
            
            return null;
        } catch (AuthException $e) {
            if ($e->getCode() === 404) {
                return null;
            }
            throw $e;
        }
    }

    /**
     * Créer une nouvelle team
     */
    public function createTeam(string $name, ?string $description = null): TeamModel
    {
        $data = $this->request('POST', '/teams', [
            'json' => [
                'name' => $name,
                'description' => $description,
            ],
        ]);
        
        if (!isset($data['team'])) {
            throw new AuthException('Failed to create team: Invalid response');
        }
        
        return TeamModel::fromArray($data['team']);
    }

    /**
     * Obtenir les membres d'une team
     */
    public function getTeamMembers(string $teamId): array
    {
        $data = $this->request('GET', "/teams/{$teamId}/members");
        
        if (!isset($data['members']) || !is_array($data['members'])) {
            return [];
        }
        
        return $data['members'];
    }

    /**
     * Ajouter un membre à une team
     */
    public function addTeamMember(
        string $teamId,
        string $email,
        string $displayName,
        string $role = 'member'
    ): bool {
        try {
            $this->request('POST', "/teams/{$teamId}/members", [
                'json' => [
                    'email' => $email,
                    'displayName' => $displayName,
                    'role' => $role,
                ],
            ]);
            
            return true;
        } catch (AuthException $e) {
            return false;
        }
    }

    /**
     * Mettre à jour le rôle d'un membre
     */
    public function updateMemberRole(
        string $teamId,
        string $userId,
        string $role
    ): bool {
        try {
            $this->request('PATCH', "/teams/{$teamId}/members/{$userId}/role", [
                'json' => [
                    'role' => $role,
                ],
            ]);
            
            return true;
        } catch (AuthException $e) {
            return false;
        }
    }

    /**
     * Retirer un membre d'une team
     */
    public function removeMember(string $teamId, string $memberId): bool
    {
        try {
            $this->request('DELETE', "/teams/{$teamId}/members/{$memberId}");
            return true;
        } catch (AuthException $e) {
            return false;
        }
    }

    // ============================================
    // PROJECT TEAMS & PERMISSIONS
    // ============================================

    /**
     * Obtenir les teams d'un projet
     */
    public function getProjectTeams(string $projectId): array
    {
        $data = $this->request('GET', "/project-teams/{$projectId}/teams");
        
        if (!isset($data['teams']) || !is_array($data['teams'])) {
            return [];
        }
        
        return array_map(
            fn($team) => TeamModel::fromArray($team),
            $data['teams']
        );
    }

    /**
     * Ajouter une team à un projet
     */
    public function addTeamToProject(
        string $projectId,
        string $teamId,
        array $roles = []
    ): bool {
        try {
            $this->request('POST', "/project-teams/{$projectId}/teams", [
                'json' => [
                    'teamId' => $teamId,
                    'roles' => $roles,
                ],
            ]);
            
            return true;
        } catch (AuthException $e) {
            return false;
        }
    }

    /**
     * Retirer une team d'un projet
     */
    public function removeTeamFromProject(string $projectId, string $teamId): bool
    {
        try {
            $this->request('DELETE', "/project-teams/{$projectId}/teams/{$teamId}");
            return true;
        } catch (AuthException $e) {
            return false;
        }
    }

    /**
     * Obtenir les permissions de l'utilisateur sur un projet
     */
    public function getProjectPermissions(string $projectId): array
    {
        $data = $this->request('GET', "/project-teams/{$projectId}/permissions");
        
        return $data['permissions'] ?? [];
    }

    /**
     * Vérifier l'accès à un projet
     */
    public function checkProjectAccess(string $projectId): bool
    {
        try {
            $data = $this->request('GET', "/project-teams/{$projectId}/check-access");
            return $data['hasAccess'] ?? false;
        } catch (AuthException $e) {
            return false;
        }
    }

    // ============================================
    // INVITATIONS
    // ============================================

    /**
     * Créer une invitation
     */
    public function createInvitation(array $invitationData): array
    {
        $data = $this->request('POST', '/invitations', [
            'json' => $invitationData,
        ]);
        
        return $data['invitation'] ?? [];
    }

    /**
     * Obtenir une invitation par son token
     */
    public function getInvitationByToken(string $token): ?array
    {
        try {
            $data = $this->request('GET', "/invitations/token/{$token}");
            return $data['invitation'] ?? null;
        } catch (AuthException $e) {
            if ($e->getCode() === 404) {
                return null;
            }
            throw $e;
        }
    }

    /**
     * Accepter une invitation
     */
    public function acceptInvitation(
        string $token,
        string $tempPassword,
        string $newPassword
    ): bool {
        try {
            $this->request('POST', '/invitations/accept', [
                'json' => [
                    'token' => $token,
                    'tempPassword' => $tempPassword,
                    'newPassword' => $newPassword,
                ],
            ]);
            
            return true;
        } catch (AuthException $e) {
            return false;
        }
    }

    /**
     * Renvoyer une invitation
     */
    public function resendInvitation(string $invitationId): bool
    {
        try {
            $this->request('POST', "/invitations/{$invitationId}/resend");
            return true;
        } catch (AuthException $e) {
            return false;
        }
    }

    // ============================================
    // HEALTH CHECK
    // ============================================

    /**
     * Vérifier la santé de l'API
     */
    public function healthCheck(): bool
    {
        try {
            $response = $this->httpClient->request('GET', '/health', [
                'timeout' => 5,
            ]);
            
            return $response->getStatusCode() === 200;
        } catch (GuzzleException $e) {
            return false;
        }
    }
}
