<div>
    {{-- Header Idem Style --}}
    <div class="mb-8">
        <div class="flex items-center gap-3 mb-3">
            <div class="icon-container">
                <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-light">
                    <span class="i-underline">Preview Deployments</span>
                </h2>
                <p class="text-sm text-light opacity-70 mt-1">Automatic deployments for pull requests</p>
            </div>
        </div>
    </div>

    {{-- Configuration Form --}}
    <div class="mb-6">
        <livewire:project.application.preview.form :application="$application" />
    </div>

    @if (count($application->additional_servers) > 0)
        <div class="alert-box info mb-6">
            <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            <div>
                <p class="text-sm">Previews will be deployed on <span class="font-semibold">{{ $application->destination->server->name }}</span>.</p>
            </div>
        </div>
    @endif

    {{-- Pull Requests Section --}}
    @if ($application->is_github_based())
        <div class="section-card mb-6">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                    <span class="category-badge">Git</span>
                    <h3 class="text-lg font-semibold text-light">Pull Requests</h3>
                </div>
                @can('update', $application)
                    <button wire:click="load_prs" class="inner-button">
                        <svg class="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Load Pull Requests
                    </button>
                @endcan
            </div>
            
            @isset($rate_limit_remaining)
                <div class="text-sm text-light opacity-60 mb-4">Requests remaining till rate limited by Git: {{ $rate_limit_remaining }}</div>
            @endisset
            <div wire:loading.remove wire:target='load_prs'>
                @if ($pull_requests->count() > 0)
                    <div class="overflow-x-auto">
                        <table class="w-full">
                        <thead>
                            <tr>
                                <th>PR Number</th>
                                <th>PR Title</th>
                                <th>Git</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                                @foreach ($pull_requests as $pull_request)
                                    <tr class="border-t border-glass hover:bg-glass/20 transition-colors">
                                    <th>{{ data_get($pull_request, 'number') }}</th>
                                    <td>{{ data_get($pull_request, 'title') }}</td>
                                    <td>
                                        <a target="_blank" class="text-xs"
                                            href="{{ data_get($pull_request, 'html_url') }}">Open PR on
                                            Git
                                            <x-external-link />
                                        </a>
                                    </td>
                                    <td class="flex flex-col gap-1 md:flex-row">
                                        @can('update', $application)
                                            <x-forms.button
                                                wire:click="add('{{ data_get($pull_request, 'number') }}', '{{ data_get($pull_request, 'html_url') }}')">
                                                Configure
                                            </x-forms.button>
                                        @endcan
                                        @can('deploy', $application)
                                            <x-forms.button
                                                wire:click="add_and_deploy('{{ data_get($pull_request, 'number') }}', '{{ data_get($pull_request, 'html_url') }}')">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 dark:text-warning"
                                                    viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
                                                    fill="none" stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M7 4v16l13 -8z" />
                                                </svg>Deploy
                                            </x-forms.button>
                                        @endcan
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                        </table>
                    </div>
                @endif
            </div>
        </div>
    @endif

    {{-- Active Deployments Section --}}
    @if ($application->previews->count() > 0)
        <div class="mb-6">
            <h3 class="text-lg font-semibold text-accent mb-4">Active Deployments</h3>
            <div class="grid grid-cols-1 gap-4">
                @foreach (data_get($application, 'previews') as $previewName => $preview)
                    <div class="glass-card p-6"
                        wire:key="preview-container-{{ $preview->pull_request_id }}">
                        {{-- Preview Header --}}
                        <div class="flex flex-wrap items-center gap-2 mb-4 text-light">
                            <span class="font-semibold text-accent">PR #{{ data_get($preview, 'pull_request_id') }}</span>
                            <span class="text-light opacity-40">•</span>
                        @if (str(data_get($preview, 'status'))->startsWith('running'))
                            <x-status.running :status="data_get($preview, 'status')" />
                        @elseif(str(data_get($preview, 'status'))->startsWith('restarting'))
                            <x-status.restarting :status="data_get($preview, 'status')" />
                        @else
                            <x-status.stopped :status="data_get($preview, 'status')" />
                        @endif
                        @if (data_get($preview, 'status') !== 'exited')
                            | <a target="_blank" href="{{ data_get($preview, 'fqdn') }}">Open Preview
                                <x-external-link />
                            </a>
                            @endif
                            <span class="text-light opacity-40">•</span>
                            <a target="_blank" href="{{ data_get($preview, 'pull_request_html_url') }}" class="text-accent hover:underline">
                                Open PR on Git
                                <x-external-link />
                            </a>
                            @if (count($parameters) > 0)
                                <span class="text-light opacity-40">•</span>
                                <a href="{{ route('project.application.deployment.index', [...$parameters, 'pull_request_id' => data_get($preview, 'pull_request_id')]) }}" class="text-accent hover:underline">
                                    Deployment Logs
                                </a>
                                <span class="text-light opacity-40">•</span>
                                <a href="{{ route('project.application.logs', [...$parameters, 'pull_request_id' => data_get($preview, 'pull_request_id')]) }}" class="text-accent hover:underline">
                                    Application Logs
                                </a>
                            @endif
                        </div>

                    @if ($application->build_pack === 'dockercompose')
                        <div class="flex flex-col gap-4 pt-4">
                            @if (collect(json_decode($preview->docker_compose_domains))->count() === 0)
                                <form wire:submit="save_preview('{{ $preview->id }}')"
                                    class="flex items-end gap-2 pt-4">
                                    <x-forms.input label="Domain" helper="One domain per preview."
                                        id="previewFqdns.{{ $previewName }}" canGate="update" :canResource="$application"></x-forms.input>
                                    @can('update', $application)
                                        <x-forms.button type="submit">Save</x-forms.button>
                                        <x-forms.button wire:click="generate_preview('{{ $preview->id }}')">Generate
                                            Domain</x-forms.button>
                                    @endcan
                                </form>
                            @else
                                @foreach (collect(json_decode($preview->docker_compose_domains)) as $serviceName => $service)
                                    <livewire:project.application.previews-compose
                                        wire:key="preview-{{ $preview->pull_request_id }}-{{ $serviceName }}"
                                        :service="$service" :serviceName="$serviceName" :preview="$preview" />
                                @endforeach
                            @endif
                        </div>
                    @else
                        <form wire:submit="save_preview('{{ $preview->id }}')" class="flex items-end gap-2 pt-4">
                            <x-forms.input label="Domain" helper="One domain per preview."
                                id="previewFqdns.{{ $previewName }}" canGate="update" :canResource="$application"></x-forms.input>
                            @can('update', $application)
                                <x-forms.button type="submit">Save</x-forms.button>
                                <x-forms.button wire:click="generate_preview('{{ $preview->id }}')">Generate
                                    Domain</x-forms.button>
                            @endcan
                        </form>
                    @endif
                    <div class="flex flex-col xl:flex-row xl:items-center gap-2 pt-6">
                        <div class="flex-1"></div>
                        @can('deploy', $application)
                            <x-forms.button
                                wire:click="force_deploy_without_cache({{ data_get($preview, 'pull_request_id') }})">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24"
                                    stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round"
                                    stroke-linejoin="round">
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                    <path
                                        d="M12.983 8.978c3.955 -.182 7.017 -1.446 7.017 -2.978c0 -1.657 -3.582 -3 -8 -3c-1.661 0 -3.204 .19 -4.483 .515m-2.783 1.228c-.471 .382 -.734 .808 -.734 1.257c0 1.22 1.944 2.271 4.734 2.74" />
                                    <path
                                        d="M4 6v6c0 1.657 3.582 3 8 3c.986 0 1.93 -.067 2.802 -.19m3.187 -.82c1.251 -.53 2.011 -1.228 2.011 -1.99v-6" />
                                    <path d="M4 12v6c0 1.657 3.582 3 8 3c3.217 0 5.991 -.712 7.261 -1.74m.739 -3.26v-4" />
                                    <path d="M3 3l18 18" />
                                </svg>
                                Force deploy (without
                                cache)
                            </x-forms.button>
                            <x-forms.button wire:click="deploy({{ data_get($preview, 'pull_request_id') }})">
                                @if (data_get($preview, 'status') === 'exited')
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 dark:text-warning"
                                        viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"
                                        stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                        <path d="M7 4v16l13 -8z" />
                                    </svg>
                                    Deploy
                                @else
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 dark:text-orange-400"
                                        viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"
                                        stroke-linecap="round" stroke-linejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                        <path
                                            d="M10.09 4.01l.496 -.495a2 2 0 0 1 2.828 0l7.071 7.07a2 2 0 0 1 0 2.83l-7.07 7.07a2 2 0 0 1 -2.83 0l-7.07 -7.07a2 2 0 0 1 0 -2.83l3.535 -3.535h-3.988">
                                        </path>
                                        <path d="M7.05 11.038v-3.988"></path>
                                    </svg> Redeploy
                                @endif
                            </x-forms.button>
                        @endcan
                        @if (data_get($preview, 'status') !== 'exited')
                            @can('deploy', $application)
                                <x-modal-confirmation title="Confirm Preview Deployment Stopping?" buttonTitle="Stop"
                                    submitAction="stop({{ data_get($preview, 'pull_request_id') }})" :actions="[
                                        'This preview deployment will be stopped.',
                                        'If the preview deployment is currently in use data could be lost.',
                                        'All non-persistent data of this preview deployment (containers, networks, unused images) will be deleted (don\'t worry, no data is lost and you can start the preview deployment again).',
                                    ]"
                                    :confirmWithText="false" :confirmWithPassword="false" step2ButtonText="Stop Preview Deployment">
                                    <x-slot:customButton>
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-error"
                                            viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"
                                            stroke-linecap="round" stroke-linejoin="round">
                                            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                            <path
                                                d="M6 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z">
                                            </path>
                                            <path
                                                d="M14 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z">
                                            </path>
                                        </svg>
                                        Stop
                                    </x-slot:customButton>
                                </x-modal-confirmation>
                            @endcan
                        @endif
                        @can('delete', $application)
                            <x-modal-confirmation title="Confirm Preview Deployment Deletion?" buttonTitle="Delete"
                                isErrorButton submitAction="delete({{ data_get($preview, 'pull_request_id') }})"
                                :actions="[
                                    'All containers of this preview deployment will be stopped and permanently deleted.',
                                ]" confirmationText="{{ data_get($preview, 'fqdn') . '/' }}"
                                confirmationLabel="Please confirm the execution of the actions by entering the Preview Deployment name below"
                                shortConfirmationLabel="Preview Deployment Name" :confirmWithPassword="false" />
                        @endcan
                    </div>
                </div>
            @endforeach
        </div>
    @endif
    
    <x-domain-conflict-modal 
        :conflicts="$domainConflicts" 
        :showModal="$showDomainConflictModal" 
        confirmAction="confirmDomainUsage">
        The preview deployment domain is already in use by other resources. Using the same domain for multiple resources can cause routing conflicts and unpredictable behavior.
        <x-slot:consequences>
            <ul class="mt-2 ml-4 list-disc">
                <li>The preview deployment may not be accessible</li>
                <li>Conflicts with production or other preview deployments</li>
                <li>SSL certificates might not work correctly</li>
                <li>Unpredictable routing behavior</li>
            </ul>
        </x-slot:consequences>
    </x-domain-conflict-modal>
</div>
