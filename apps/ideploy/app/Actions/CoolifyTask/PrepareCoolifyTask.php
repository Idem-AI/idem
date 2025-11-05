<?php

namespace App\Actions\IdeployTask;

use App\Data\IdeployTaskArgs;
use App\Jobs\IdeployTask;
use Spatie\Activitylog\Models\Activity;

/**
 * The initial step to run a `IdeployTask`: a remote SSH process
 * with monitoring/tracking/trace feature. Such thing is made
 * possible using an Activity model and some attributes.
 */
class PrepareIdeployTask
{
    protected Activity $activity;

    protected IdeployTaskArgs $remoteProcessArgs;

    public function __construct(IdeployTaskArgs $remoteProcessArgs)
    {
        $this->remoteProcessArgs = $remoteProcessArgs;

        if ($remoteProcessArgs->model) {
            $properties = $remoteProcessArgs->toArray();
            unset($properties['model']);

            $this->activity = activity()
                ->withProperties($properties)
                ->performedOn($remoteProcessArgs->model)
                ->event($remoteProcessArgs->type)
                ->log('[]');
        } else {
            $this->activity = activity()
                ->withProperties($remoteProcessArgs->toArray())
                ->event($remoteProcessArgs->type)
                ->log('[]');
        }
    }

    public function __invoke(): Activity
    {
        $job = new IdeployTask(
            activity: $this->activity,
            ignore_errors: $this->remoteProcessArgs->ignore_errors,
            call_event_on_finish: $this->remoteProcessArgs->call_event_on_finish,
            call_event_data: $this->remoteProcessArgs->call_event_data,
        );
        dispatch($job);
        $this->activity->refresh();

        return $this->activity;
    }
}
