<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\IdemServerService;
use App\Models\PrivateKey;

class IdemCreateServer extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'idem:create-server 
                            {name : Server name}
                            {ip : Server IP address}
                            {--user=root : SSH user}
                            {--port=22 : SSH port}
                            {--key-id= : Private key ID}
                            {--description= : Server description}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new IDEM managed server';

    /**
     * Execute the console command.
     */
    public function handle(IdemServerService $serverService): int
    {
        $name = $this->argument('name');
        $ip = $this->argument('ip');
        $user = $this->option('user');
        $port = $this->option('port');
        $keyId = $this->option('key-id');
        $description = $this->option('description');

        // Validate private key if provided
        if ($keyId) {
            $privateKey = PrivateKey::find($keyId);
            if (!$privateKey) {
                $this->error("Private key with ID {$keyId} not found.");
                return Command::FAILURE;
            }
        } else {
            // Find the first available private key from root team
            $privateKey = PrivateKey::where('team_id', 0)->first();
            if (!$privateKey) {
                $this->error('No private key found for root team. Please create one first or specify --key-id.');
                return Command::FAILURE;
            }
            $this->info("Using private key: {$privateKey->name} (ID: {$privateKey->id})");
        }

        $this->info('Creating IDEM managed server...');

        try {
            $server = $serverService->createManagedServer([
                'name' => $name,
                'ip' => $ip,
                'user' => $user,
                'port' => $port,
                'description' => $description ?? "IDEM managed server - {$name}",
                'private_key_id' => $privateKey->id,
            ]);

            $this->info('✅ Server created successfully!');
            $this->table(
                ['Field', 'Value'],
                [
                    ['ID', $server->id],
                    ['UUID', $server->uuid],
                    ['Name', $server->name],
                    ['IP', $server->ip],
                    ['User', $server->user],
                    ['Port', $server->port],
                    ['Managed', $server->idem_managed ? 'Yes' : 'No'],
                    ['Team ID', $server->team_id],
                ]
            );

            $this->newLine();
            $this->warn('⚠️  Next steps:');
            $this->line('1. Validate server connectivity');
            $this->line('2. Install Docker if not present');
            $this->line('3. Configure proxy settings');
            $this->line("4. Run: php artisan server:validate {$server->uuid}");

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed to create server: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
