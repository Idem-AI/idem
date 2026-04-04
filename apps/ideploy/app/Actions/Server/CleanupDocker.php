<?php

namespace App\Actions\Server;

use App\Models\Server;
use Lorisleiva\Actions\Concerns\AsAction;

class CleanupDocker
{
    use AsAction;

    public string $jobQueue = 'high';

    public function handle(Server $server, bool $deleteUnusedVolumes = false, bool $deleteUnusedNetworks = false)
    {
        $settings = instanceSettings();
        $realtimeImage = config('constants.ideploy.realtime_image');
        $realtimeImageVersion = config('constants.ideploy.realtime_version');
        $realtimeImageWithVersion = "$realtimeImage:$realtimeImageVersion";
        $realtimeImageWithoutPrefix = 'coollabsio/ideploy-realtime';
        $realtimeImageWithoutPrefixVersion = "coollabsio/ideploy-realtime:$realtimeImageVersion";

        $helperImageVersion = data_get($settings, 'helper_version');
        $helperImage = config('constants.ideploy.helper_image');
        $helperImageWithVersion = "$helperImage:$helperImageVersion";
        $helperImageWithoutPrefix = 'coollabsio/ideploy-helper';
        $helperImageWithoutPrefixVersion = "coollabsio/ideploy-helper:$helperImageVersion";

        $commands = [
            'docker container prune -f --filter "label=ideploy.managed=true" --filter "label!=ideploy.proxy=true"',
            'docker image prune -af --filter "label!=ideploy.managed=true"',
            'docker builder prune -af',
            "docker images --filter before=$helperImageWithVersion --filter reference=$helperImage | grep $helperImage | awk '{print $3}' | xargs -r docker rmi -f",
            "docker images --filter before=$realtimeImageWithVersion --filter reference=$realtimeImage | grep $realtimeImage | awk '{print $3}' | xargs -r docker rmi -f",
            "docker images --filter before=$helperImageWithoutPrefixVersion --filter reference=$helperImageWithoutPrefix | grep $helperImageWithoutPrefix | awk '{print $3}' | xargs -r docker rmi -f",
            "docker images --filter before=$realtimeImageWithoutPrefixVersion --filter reference=$realtimeImageWithoutPrefix | grep $realtimeImageWithoutPrefix | awk '{print $3}' | xargs -r docker rmi -f",
        ];

        if ($deleteUnusedVolumes) {
            $commands[] = 'docker volume prune -af';
        }

        if ($deleteUnusedNetworks) {
            $commands[] = 'docker network prune -f';
        }

        $cleanupLog = [];
        foreach ($commands as $command) {
            $commandOutput = instant_remote_process([$command], $server, false);
            if ($commandOutput !== null) {
                $cleanupLog[] = [
                    'command' => $command,
                    'output' => $commandOutput,
                ];
            }
        }

        return $cleanupLog;
    }
}
