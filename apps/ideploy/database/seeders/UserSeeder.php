<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Check if users already exist
        if (User::count() > 0) {
            $this->command->info('Users already exist, skipping creation.');
            return;
        }

        // Create users without factories (production-safe)
        User::create([
            'id' => 0,
            'name' => 'Root User',
            'email' => 'test@example.com',
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
            'remember_token' => Str::random(10),
        ]);

        User::create([
            'id' => 1,
            'name' => 'Normal User (but in root team)',
            'email' => 'test2@example.com',
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
            'remember_token' => Str::random(10),
        ]);

        User::create([
            'id' => 2,
            'name' => 'Normal User (not in root team)',
            'email' => 'test3@example.com',
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
            'remember_token' => Str::random(10),
        ]);

        $this->command->info('Users created successfully.');
    }
}
