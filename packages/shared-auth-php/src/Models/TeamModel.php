<?php

namespace Idem\SharedAuth\Models;

use DateTime;

/**
 * Rôle d'un membre dans une équipe
 */
enum TeamRole: string
{
    case OWNER = 'owner';
    case ADMIN = 'admin';
    case MEMBER = 'member';
    case VIEWER = 'viewer';
}

/**
 * Membre d'une équipe
 */
class TeamMember
{
    public string $userId;
    public string $email;
    public string $displayName;
    public TeamRole $role;
    public DateTime $addedAt;
    public string $addedBy; // userId qui a ajouté ce membre
    public bool $isActive = true;

    public function __construct(array $data = [])
    {
        $this->addedAt = new DateTime();
        
        foreach ($data as $key => $value) {
            if ($key === 'role' && is_string($value)) {
                $this->role = TeamRole::from($value);
            } elseif (property_exists($this, $key)) {
                $this->$key = $value;
            }
        }
    }

    public function toArray(): array
    {
        return [
            'userId' => $this->userId,
            'email' => $this->email,
            'displayName' => $this->displayName,
            'role' => $this->role->value,
            'addedAt' => $this->addedAt->format('c'),
            'addedBy' => $this->addedBy,
            'isActive' => $this->isActive,
        ];
    }

    public static function fromArray(array $data): self
    {
        $member = new self();
        $member->userId = $data['userId'];
        $member->email = $data['email'];
        $member->displayName = $data['displayName'];
        $member->role = TeamRole::from($data['role']);
        
        if (isset($data['addedAt'])) {
            $member->addedAt = new DateTime($data['addedAt']);
        }
        
        $member->addedBy = $data['addedBy'];
        $member->isActive = $data['isActive'] ?? true;
        
        return $member;
    }
}

/**
 * Modèle d'équipe
 * Basé sur shared-models/src/auth/team.model.ts
 */
class TeamModel
{
    public ?string $id = null;
    public string $name;
    public ?string $description = null;
    public string $ownerId; // Créateur de la team
    /** @var TeamMember[] */
    public array $members = [];
    /** @var string[] */
    public array $projectIds = [];
    public DateTime $createdAt;
    public DateTime $updatedAt;
    public bool $isActive = true;

    public function __construct(array $data = [])
    {
        $this->createdAt = new DateTime();
        $this->updatedAt = new DateTime();
        
        foreach ($data as $key => $value) {
            if ($key === 'members' && is_array($value)) {
                $this->members = array_map(
                    fn($m) => is_array($m) ? TeamMember::fromArray($m) : $m,
                    $value
                );
            } elseif (property_exists($this, $key)) {
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
            'name' => $this->name,
            'description' => $this->description,
            'ownerId' => $this->ownerId,
            'members' => array_map(fn($m) => $m->toArray(), $this->members),
            'projectIds' => $this->projectIds,
            'createdAt' => $this->createdAt->format('c'),
            'updatedAt' => $this->updatedAt->format('c'),
            'isActive' => $this->isActive,
        ];
    }

    /**
     * Créer depuis un tableau
     */
    public static function fromArray(array $data): self
    {
        $team = new self();
        
        $team->id = $data['id'] ?? null;
        $team->name = $data['name'];
        $team->description = $data['description'] ?? null;
        $team->ownerId = $data['ownerId'];
        
        if (isset($data['members']) && is_array($data['members'])) {
            $team->members = array_map(
                fn($m) => TeamMember::fromArray($m),
                $data['members']
            );
        }
        
        $team->projectIds = $data['projectIds'] ?? [];
        
        if (isset($data['createdAt'])) {
            $team->createdAt = new DateTime($data['createdAt']);
        }
        
        if (isset($data['updatedAt'])) {
            $team->updatedAt = new DateTime($data['updatedAt']);
        }
        
        $team->isActive = $data['isActive'] ?? true;
        
        return $team;
    }

    /**
     * Vérifier si un utilisateur est membre de la team
     */
    public function hasMember(string $userId): bool
    {
        foreach ($this->members as $member) {
            if ($member->userId === $userId && $member->isActive) {
                return true;
            }
        }
        return false;
    }

    /**
     * Obtenir le rôle d'un utilisateur dans la team
     */
    public function getMemberRole(string $userId): ?TeamRole
    {
        foreach ($this->members as $member) {
            if ($member->userId === $userId && $member->isActive) {
                return $member->role;
            }
        }
        return null;
    }

    /**
     * Vérifier si un utilisateur est owner ou admin
     */
    public function isAdminOrOwner(string $userId): bool
    {
        if ($this->ownerId === $userId) {
            return true;
        }
        
        $role = $this->getMemberRole($userId);
        return $role === TeamRole::OWNER || $role === TeamRole::ADMIN;
    }
}
