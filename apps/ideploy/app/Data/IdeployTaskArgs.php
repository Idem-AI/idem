<?php

namespace App\Data;

use Illuminate\Database\Eloquent\Model;
use Spatie\LaravelData\Data;

class IdeployTaskArgs extends Data
{
    public function __construct(
        public string $server_uuid,
        public string $command,
        public string $type,
        public ?string $type_uuid = null,
        public ?Model $model = null,
        public bool $ignore_errors = false,
        public ?string $call_event_on_finish = null,
        public mixed $call_event_data = null,
    ) {}
}
