<?php

namespace Database\Seeders;

use App\Models\GitlabApp;
use Illuminate\Database\Seeder;

class GitlabAppSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Check if Public GitLab app already exists
        if (GitlabApp::where('id', 1)->exists()) {
            $this->command->info('Public GitLab app already exists, skipping creation.');
            return;
        }

        GitlabApp::create([
            'id' => 1,
            'name' => 'Public GitLab',
            'api_url' => 'https://gitlab.com/api/v4',
            'html_url' => 'https://gitlab.com',
            'is_public' => true,
            'team_id' => 0,
        ]);

        $this->command->info('Public GitLab app created successfully.');
    }
}
