<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;

class TeamSeeder extends Seeder
{
    public function run(): void
    {
        // Check if teams already exist
        if (Team::count() > 0) {
            $this->command->info('Teams already exist, skipping creation.');
            return;
        }

        // Get users
        $root_user = User::find(0);
        $normal_user_in_root_team = User::find(1);
        $normal_user_not_in_root_team = User::find(2);

        // Check if users exist
        if (!$root_user || !$normal_user_in_root_team || !$normal_user_not_in_root_team) {
            $this->command->error('Users not found. Please run UserSeeder first.');
            return;
        }

        // Create root team (id: 0)
        $root_user_personal_team = Team::create([
            'id' => 0,
            'name' => 'Root Team',
            'description' => 'The root team',
            'personal_team' => true,
        ]);

        // Attach root user to root team
        $root_user->teams()->attach($root_user_personal_team, ['role' => 'owner']);

        // Attach normal user to root team
        $normal_user_in_root_team->teams()->attach($root_user_personal_team);

        // Create personal team for normal user (id: 1)
        $normal_user_in_root_team_personal_team = Team::create([
            'id' => 1,
            'name' => 'Normal User Team',
            'description' => 'Personal team for normal user',
            'personal_team' => true,
        ]);

        // Attach normal user to their personal team
        $normal_user_in_root_team->teams()->attach($normal_user_in_root_team_personal_team, ['role' => 'owner']);

        // Attach other normal user to the team
        $normal_user_not_in_root_team->teams()->attach($normal_user_in_root_team_personal_team, ['role' => 'admin']);

        $this->command->info('Teams created and users attached successfully.');
    }
}
