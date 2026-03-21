@props([
    'lastDeploymentInfo' => null,
    'lastDeploymentLink' => null,
    'resource' => null,
])
<nav class="flex pt-2 pb-6">
    <ol class="flex flex-wrap items-center gap-2">
        <li class="inline-flex items-center">
            <a class="text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800/50"
                href="{{ route('project.show', ['project_uuid' => data_get($resource, 'environment.project.uuid')]) }}">
                {{ data_get($resource, 'environment.project.name', 'Undefined Name') }}
            </a>
            <svg class="w-4 h-4 mx-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        </li>
        <li class="inline-flex items-center">
            <a class="text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800/50"
                href="{{ route('project.resource.index', [
                    'environment_uuid' => data_get($resource, 'environment.uuid'),
                    'project_uuid' => data_get($resource, 'environment.project.uuid'),
                ]) }}">
                {{ data_get($resource, 'environment.name') }}
            </a>
            <svg class="w-4 h-4 mx-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        </li>
        <li class="inline-flex items-center">
            <span class="text-sm font-semibold text-white px-3 py-1.5 bg-gray-800/30 rounded-lg">{{ data_get($resource, 'name') }}</span>
            <svg class="w-4 h-4 mx-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        </li>
        @if ($resource->getMorphClass() == 'App\Models\Service')
            <x-status.services :service="$resource" />
        @else
            <x-status.index :resource="$resource" :title="$lastDeploymentInfo" :lastDeploymentLink="$lastDeploymentLink" />
        @endif
    </ol>
</nav>
