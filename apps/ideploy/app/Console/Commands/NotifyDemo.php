<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

use function Termwind\ask;
use function Termwind\render;
use function Termwind\style;

class NotifyDemo extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:demo-notify {channel?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send a demo notification, to a given channel. Run to see options.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $channel = $this->argument('channel');

        if (blank($channel)) {
            $this->showHelp();

            return;
        }
    }

    private function showHelp()
    {
        style('ideploy')->color('#9333EA');
        style('title-box')->apply('mt-1 px-2 py-1 bg-ideploy');

        render(
            <<<'HTML'
        <div>
            <div class="title-box">
                Coolify
            </div>
            <p class="mt-1 ml-1 ">
              Demo Notify <strong class="text-ideploy">=></strong> Send a demo notification to a given channel.
            </p>
            <p class="px-1 mt-1 ml-1 bg-ideploy">
              php artisan app:demo-notify {channel}
            </p>
            <div class="my-1">
                <div class="text-yellow-500"> Channels: </div>
                <ul class="text-ideploy">
                    <li>email</li>
                    <li>discord</li>
                    <li>telegram</li>
                    <li>slack</li>
                    <li>pushover</li>
                </ul>
            </div>
        </div>
        HTML
        );

        ask(<<<'HTML'
        <div class="mr-1">
            In which manner you wish a <strong class="text-ideploy">coolified</strong> notification?
        </div>
        HTML, ['email', 'discord', 'telegram', 'slack', 'pushover']);
    }
}
