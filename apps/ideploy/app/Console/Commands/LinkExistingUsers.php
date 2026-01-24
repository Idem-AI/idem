<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class LinkExistingUsers extends Command
{
    protected $signature = 'idem:link-existing-users';
    protected $description = 'Show existing users without idem_uid that need to be linked';

    public function handle(): int
    {
        $this->info('🔍 Checking for users without IDEM UID...');
        $this->newLine();

        $usersWithoutIdemUid = User::whereNull('idem_uid')->get();

        if ($usersWithoutIdemUid->isEmpty()) {
            $this->info('✅ All users are already linked to IDEM!');
            return Command::SUCCESS;
        }

        $this->warn("Found {$usersWithoutIdemUid->count()} user(s) without IDEM UID:");
        $this->newLine();

        $table = [];
        foreach ($usersWithoutIdemUid as $user) {
            $table[] = [
                'ID' => $user->id,
                'Name' => $user->name,
                'Email' => $user->email,
                'Created' => $user->created_at->format('Y-m-d H:i'),
            ];
        }

        $this->table(['ID', 'Name', 'Email', 'Created'], $table);
        $this->newLine();

        $this->info('ℹ️  These users will be automatically linked when they login via IDEM.');
        $this->info('   No manual action required!');
        $this->newLine();

        $this->line('When a user logs in:');
        $this->line('1. The middleware will verify their session with IDEM API');
        $this->line('2. If the email matches, their account will be linked');
        $this->line('3. The idem_uid will be added to their account');
        
        return Command::SUCCESS;
    }
}
