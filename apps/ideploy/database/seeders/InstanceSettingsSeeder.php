<?php

namespace Database\Seeders;

use App\Models\InstanceSettings;
use Illuminate\Database\Seeder;

class InstanceSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Check if InstanceSettings already exists to avoid duplicates
        if (InstanceSettings::where('id', 0)->exists()) {
            echo "InstanceSettings already exists, skipping creation.\n";
            return;
        }

        // Create default InstanceSettings with production-safe values
        InstanceSettings::create([
            'id' => 0,
            'fqdn' => env('APP_URL', 'http://localhost:8000'),
            'public_port_min' => 30000,
            'public_port_max' => 65535,
            'is_registration_enabled' => env('REGISTRATION_ENABLED', false),
            'is_api_enabled' => env('API_ENABLED', true),
            'is_auto_update_enabled' => false,
            'auto_update_frequency' => '0 0 * * *',
            'update_check_frequency' => '0 * * * *',
            'is_dns_validation_enabled' => true,
            'disable_two_step_confirmation' => false,
            'smtp_enabled' => false,
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_timeout' => 30,
            'smtp_from_address' => env('MAIL_FROM_ADDRESS', 'noreply@example.com'),
            'smtp_from_name' => env('MAIL_FROM_NAME', 'iDeploy'),
            'resend_enabled' => false,
            'instance_name' => env('INSTANCE_NAME', 'iDeploy'),
            'is_sponsorship_popup_enabled' => true,
            'helper_version' => '1.0.0',
            'do_not_track' => false,
            'next_channel' => false,
            'new_version_available' => false,
            'instance_timezone' => config('app.timezone', 'UTC'),
            'allowed_ips' => json_encode(['0.0.0.0/0']),
        ]);
        
        echo "InstanceSettings created successfully.\n";
    }
}
