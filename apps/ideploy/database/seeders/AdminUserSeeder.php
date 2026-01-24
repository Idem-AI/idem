<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed un utilisateur admin IDEM
     * 
     * Utilisation:
     * php artisan db:seed --class=AdminUserSeeder
     */
    public function run(): void
    {
        // Vérifier si un admin existe déjà
        $existingAdmin = User::where('idem_role', 'admin')->first();
        
        if ($existingAdmin) {
            $this->command->info("✅ Un admin existe déjà: {$existingAdmin->email}");
            return;
        }

        // Récupérer le premier utilisateur ou utiliser un email spécifique
        $email = $this->command->ask('Email de l\'admin (laisser vide pour utiliser le premier user)', '');
        
        if (empty($email)) {
            $user = User::first();
            if (!$user) {
                $this->command->error('❌ Aucun utilisateur trouvé dans la base de données');
                return;
            }
        } else {
            $user = User::where('email', $email)->first();
            if (!$user) {
                $this->command->error("❌ Utilisateur avec l'email {$email} introuvable");
                return;
            }
        }

        // Promouvoir en admin
        $user->update(['idem_role' => 'admin']);
        
        $this->command->info("✅ Utilisateur {$user->email} promu en administrateur IDEM");
        $this->command->info("   ID: {$user->id}");
        $this->command->info("   Nom: {$user->name}");
        $this->command->info("   Rôle: {$user->idem_role}");
    }
}
