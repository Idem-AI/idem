<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\LocalPersistentVolume;
use Illuminate\Database\Seeder;

class LocalPersistentVolumeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Check if persistent volume already exists
        if (LocalPersistentVolume::where('name', 'test-pv')
            ->where('resource_id', 1)
            ->where('resource_type', Application::class)
            ->exists()) {
            $this->command->info('Test persistent volume already exists, skipping creation.');
            return;
        }

        LocalPersistentVolume::create([
            'name' => 'test-pv',
            'mount_path' => '/data',
            'resource_id' => 1,
            'resource_type' => Application::class,
        ]);

        $this->command->info('Test persistent volume created successfully.');
    }
}
