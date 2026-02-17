<div>
    {{-- Header Idem Style --}}
    <div class="mb-8">
        <div class="flex items-center gap-3 mb-3">
            <div class="icon-container">
                <svg class="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-light">
                    <span class="i-underline">Webhooks</span>
                </h2>
                <p class="text-sm text-light opacity-70 mt-1">Configure webhooks to trigger deployments and other actions</p>
            </div>
        </div>
        <div class="alert-box info">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
                <p class="text-sm">For more details, check our <a class='underline font-semibold hover:text-white' href='https://coolify.io/docs/api/operations/deploy-by-tag-or-uuid' target='_blank'>documentation</a>.</p>
            </div>
        </div>
    </div>

    <div class="flex flex-col gap-6">
        {{-- Deploy Webhook Section --}}
        <div class="section-card">
            <div class="flex items-center gap-2 mb-4">
                <span class="category-badge">Deploy</span>
                <h3 class="text-lg font-semibold text-light">Deploy Webhook</h3>
            </div>
            <x-forms.input readonly
                helper="See details in our <a target='_blank' class='underline dark:text-white' href='https://coolify.io/docs/api/operations/deploy-by-tag-or-uuid'>documentation</a>."
                label="Deploy Webhook (auth required)" id="deploywebhook"></x-forms.input>
        </div>
        {{-- Manual Git Webhooks Section --}}
        @if ($resource->type() === 'application')
            <div class="section-card">
                <div class="flex items-center gap-2 mb-4">
                    <span class="category-badge">Git</span>
                    <h3 class="text-lg font-semibold text-light">Manual Git Webhooks</h3>
                </div>
                @if ($githubManualWebhook && $gitlabManualWebhook)
                    <form wire:submit='submit' class="flex flex-col gap-4">
                    {{-- GitHub --}}
                    <div class="space-y-3">
                        <div class="flex items-center gap-2 text-light">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            <span class="font-semibold">GitHub</span>
                        </div>
                        <div class="flex items-end gap-2">
                            <x-forms.input helper="Content Type in GitHub configuration could be json or form-urlencoded."
                                readonly label="Webhook URL" id="githubManualWebhook"></x-forms.input>
                            @can('update', $resource)
                                <x-forms.input type="password"
                                    helper="Need to set a secret to be able to use this webhook. It should match with the secret in GitHub."
                                    label="Webhook Secret" id="githubManualWebhookSecret"></x-forms.input>
                            @else
                                <x-forms.input disabled type="password"
                                    helper="Need to set a secret to be able to use this webhook. It should match with the secret in GitHub."
                                    label="Webhook Secret" id="githubManualWebhookSecret"></x-forms.input>
                            @endcan
                        </div>
                    </div>
                    <a target="_blank" class="inline-flex hover:no-underline" href="{{ $resource?->gitWebhook }}">
                        <button class="inner-button">
                            Webhook Configuration on GitHub
                            <x-external-link />
                        </button>
                    </a>

                    {{-- GitLab --}}
                    <div class="space-y-3 pt-2 border-t border-glass">
                        <div class="flex items-center gap-2 text-light">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L.397 10.93c-.531.529-.531 1.487 0 2.019l10.48 10.478c.604.604 1.582.604 2.188 0l10.48-10.478c.53-.532.53-1.49 0-2.02z"/>
                            </svg>
                            <span class="font-semibold">GitLab</span>
                        </div>
                        <div class="flex gap-2">
                            <x-forms.input readonly label="Webhook URL" id="gitlabManualWebhook"></x-forms.input>
                        @can('update', $resource)
                            <x-forms.input type="password"
                                helper="Need to set a secret to be able to use this webhook. It should match with the secret in GitLab."
                                label="GitLab Webhook Secret" id="gitlabManualWebhookSecret"></x-forms.input>
                        @else
                            <x-forms.input disabled type="password"
                                helper="Need to set a secret to be able to use this webhook. It should match with the secret in GitLab."
                                label="GitLab Webhook Secret" id="gitlabManualWebhookSecret"></x-forms.input>
                        @endcan
                        </div>
                    </div>

                    {{-- Bitbucket --}}
                    <div class="space-y-3 pt-2 border-t border-glass">
                        <div class="flex items-center gap-2 text-light">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M.778 1.211c-.424 0-.772.346-.772.772a.773.773 0 00.062.289l3.263 19.811c.095.567.567.984 1.146.984h15.028c.386 0 .713-.289.772-.675l3.263-20.047a.771.771 0 00-.772-.867H.778zm14.52 15.528H8.7l-1.313-7.944h9.144l-1.232 7.944z"/>
                            </svg>
                            <span class="font-semibold">Bitbucket</span>
                        </div>
                        <div class="flex gap-2">
                            <x-forms.input readonly label="Webhook URL" id="bitbucketManualWebhook"></x-forms.input>
                        @can('update', $resource)
                            <x-forms.input type="password"
                                helper="Need to set a secret to be able to use this webhook. It should match with the secret in Bitbucket."
                                label="Bitbucket Webhook Secret" id="bitbucketManualWebhookSecret"></x-forms.input>
                        @else
                            <x-forms.input disabled type="password"
                                helper="Need to set a secret to be able to use this webhook. It should match with the secret in Bitbucket."
                                label="Bitbucket Webhook Secret" id="bitbucketManualWebhookSecret"></x-forms.input>
                        @endcan
                        </div>
                    </div>

                    {{-- Gitea --}}
                    <div class="space-y-3 pt-2 border-t border-glass">
                        <div class="flex items-center gap-2 text-light">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4.186 12.143c0 3.47 2.303 6.398 5.476 7.372l-.267-2.238-.955.063-.239-.005c-.886-.065-1.445-.424-1.738-.882-.219-.344-.41-.923-.676-1.628l-.016-.043c-.26-.688-.589-1.557-1.042-2.178-.132-.18-.277-.337-.433-.468.464-.096.906.047 1.228.342.336.308.586.753.833 1.239.265.527.523 1.063.865 1.449.336.38.792.628 1.416.696l.148.01c.126.004.252.005.375.002l.267-2.287c-.282-.109-.542-.263-.773-.458a3.63 3.63 0 01-.603-.668l-.003-.005c-.176-.23-.335-.486-.472-.762-.138-.277-.252-.568-.336-.865a3.935 3.935 0 01-.196-1.216c0-.691.177-1.309.514-1.857.339-.551.81-.984 1.39-1.28-.093-.342-.139-.699-.139-1.065 0-.512.126-1.003.363-1.442a2.8 2.8 0 011.016-1.019 2.837 2.837 0 011.442-.363c.367 0 .724.046 1.066.139.296-.58.729-1.051 1.28-1.39.548-.337 1.166-.514 1.857-.514.69 0 1.309.177 1.857.514.55.339.984.81 1.28 1.39.342-.093.699-.139 1.065-.139.512 0 1.003.126 1.442.363a2.8 2.8 0 011.019 1.019c.237.439.363.93.363 1.442 0 .366-.046.723-.139 1.065.58.296 1.051.729 1.39 1.28.337.548.514 1.166.514 1.857 0 .413-.067.814-.196 1.216-.084.297-.198.588-.336.865-.137.276-.296.532-.472.762l-.003.005c-.181.233-.39.446-.603.668-.231.195-.491.349-.773.458l.267 2.287c.123.003.249.002.375-.002l.148-.01c.624-.068 1.08-.316 1.416-.696.342-.386.6-.922.865-1.449.247-.486.497-.931.833-1.239.322-.295.764-.438 1.228-.342-.156.131-.301.288-.433.468-.453.621-.782 1.49-1.042 2.178l-.016.043c-.266.705-.457 1.284-.676 1.628-.293.458-.852.817-1.738.882l-.239.005-.955-.063-.267 2.238c3.173-.974 5.476-3.902 5.476-7.372 0-4.27-3.474-7.744-7.743-7.744-4.27 0-7.744 3.474-7.744 7.744z"/>
                            </svg>
                            <span class="font-semibold">Gitea</span>
                        </div>
                        <div class="flex gap-2">
                            <x-forms.input readonly label="Webhook URL" id="giteaManualWebhook"></x-forms.input>
                        @can('update', $resource)
                            <x-forms.input type="password"
                                helper="Need to set a secret to be able to use this webhook. It should match with the secret in Gitea."
                                label="Gitea Webhook Secret" id="giteaManualWebhookSecret"></x-forms.input>
                        @else
                            <x-forms.input disabled type="password"
                                helper="Need to set a secret to be able to use this webhook. It should match with the secret in Gitea."
                                label="Gitea Webhook Secret" id="giteaManualWebhookSecret"></x-forms.input>
                        @endcan
                        </div>
                    </div>

                    @can('update', $resource)
                        <div class="pt-2">
                            <button type="submit" class="inner-button">
                                <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Save Webhooks
                            </button>
                        </div>
                    @endcan
                    </form>
                @else
                    <div class="glass-card p-4 bg-info/10">
                        <div class="flex items-start gap-3 text-info">
                            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                            </svg>
                            <div>
                                <h4 class="font-semibold mb-1">Information</h4>
                                <p class="text-sm opacity-90">You are using an official Git App. You do not need manual webhooks.</p>
                            </div>
                        </div>
                    </div>
                @endif
            </div>
        @endif
    </div>
</div>
