<div>
    @if($showModal)
        <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <!-- Background overlay -->
                <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" 
                     wire:click="close"></div>

                <!-- Center modal -->
                <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div class="inline-block align-bottom bg-white dark:bg-coolgray-100 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                    <div class="bg-white dark:bg-coolgray-100 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start">
                            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 sm:mx-0 sm:h-10 sm:w-10">
                                <svg class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                </svg>
                            </div>
                            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                                <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                    🚀 Choose Deployment Environment
                                </h3>
                                <div class="mt-4">
                                    <p class="text-sm text-gray-500 dark:text-gray-400">
                                        Select where you want to deploy your application
                                    </p>

                                    <!-- Deployment Options -->
                                    <div class="mt-6 space-y-4">
                                        <!-- Option 1: IDEM Managed -->
                                        <div class="relative">
                                            <input type="radio" 
                                                   id="deploy-managed" 
                                                   wire:model.live="deployOnManaged" 
                                                   value="true"
                                                   class="sr-only peer">
                                            <label for="deploy-managed" 
                                                   class="flex items-start p-4 border-2 rounded-lg cursor-pointer
                                                          peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20
                                                          border-gray-300 dark:border-coolgray-300 hover:border-blue-300 dark:hover:border-blue-700
                                                          transition-all">
                                                <div class="flex-1">
                                                    <div class="flex items-center">
                                                        <span class="text-2xl mr-3">☁️</span>
                                                        <div>
                                                            <p class="text-base font-semibold text-gray-900 dark:text-white">
                                                                IDEM Managed Servers
                                                                <span class="ml-2 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                                                                    Recommended
                                                                </span>
                                                            </p>
                                                            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                                Deploy on our managed infrastructure with automatic load balancing
                                                            </p>
                                                            <ul class="mt-2 space-y-1">
                                                                <li class="text-xs text-gray-600 dark:text-gray-400">✓ High availability</li>
                                                                <li class="text-xs text-gray-600 dark:text-gray-400">✓ Automatic scaling</li>
                                                                <li class="text-xs text-gray-600 dark:text-gray-400">✓ No server management</li>
                                                                <li class="text-xs text-gray-600 dark:text-gray-400">✓ {{ $managedServersCount }} servers available</li>
                                                            </ul>
                                                        </div>
                                                    </div>

                                                    @if($deployOnManaged)
                                                        <div class="mt-4 pl-11">
                                                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                                Load Balancing Strategy
                                                            </label>
                                                            <select wire:model="serverStrategy" 
                                                                    class="block w-full px-3 py-2 border border-gray-300 dark:border-coolgray-300 
                                                                           rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 
                                                                           dark:bg-coolgray-200 dark:text-white text-sm">
                                                                @foreach($availableStrategies as $key => $label)
                                                                    <option value="{{ $key }}">{{ $label }}</option>
                                                                @endforeach
                                                            </select>
                                                        </div>
                                                    @endif
                                                </div>
                                            </label>
                                        </div>

                                        <!-- Option 2: Personal Servers -->
                                        <div class="relative">
                                            <input type="radio" 
                                                   id="deploy-personal" 
                                                   wire:model.live="deployOnManaged" 
                                                   value="false"
                                                   class="sr-only peer"
                                                   @if(!$canAddServers) disabled @endif>
                                            <label for="deploy-personal" 
                                                   class="flex items-start p-4 border-2 rounded-lg cursor-pointer
                                                          peer-checked:border-purple-500 peer-checked:bg-purple-50 dark:peer-checked:bg-purple-900/20
                                                          border-gray-300 dark:border-coolgray-300 hover:border-purple-300 dark:hover:border-purple-700
                                                          transition-all
                                                          @if(!$canAddServers) opacity-50 cursor-not-allowed @endif">
                                                <div class="flex-1">
                                                    <div class="flex items-center">
                                                        <span class="text-2xl mr-3">🖥️</span>
                                                        <div>
                                                            <p class="text-base font-semibold text-gray-900 dark:text-white">
                                                                Your Personal Servers
                                                            </p>
                                                            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                                Deploy on your own infrastructure
                                                            </p>
                                                            
                                                            @if(!$canAddServers)
                                                                <div class="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                                                                    <p class="text-xs text-yellow-800 dark:text-yellow-300">
                                                                        ⚠️ Server quota reached ({{ $serverQuota['used'] }}/{{ $serverQuota['limit'] }}). 
                                                                        <a href="{{ route('idem.subscription') }}" class="underline font-medium">Upgrade your plan</a>
                                                                    </p>
                                                                </div>
                                                            @else
                                                                <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                                                    Quota: {{ $serverQuota['used'] }}/{{ $serverQuota['unlimited'] ? '∞' : $serverQuota['limit'] }} servers used
                                                                </p>
                                                            @endif
                                                        </div>
                                                    </div>

                                                    @if(!$deployOnManaged && $canAddServers)
                                                        <div class="mt-4 pl-11">
                                                            @if($personalServers->count() > 0)
                                                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                                    Select Server
                                                                </label>
                                                                <select wire:model="personalServerId" 
                                                                        class="block w-full px-3 py-2 border border-gray-300 dark:border-coolgray-300 
                                                                               rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 
                                                                               dark:bg-coolgray-200 dark:text-white text-sm">
                                                                    <option value="">Choose a server...</option>
                                                                    @foreach($personalServers as $server)
                                                                        <option value="{{ $server->id }}">{{ $server->name }} ({{ $server->ip }})</option>
                                                                    @endforeach
                                                                </select>
                                                            @else
                                                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                                                    You don't have any personal servers yet. 
                                                                    <a href="{{ route('server.create') }}" class="text-purple-600 dark:text-purple-400 underline">Add one now</a>
                                                                </p>
                                                            @endif
                                                        </div>
                                                    @endif
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="bg-gray-50 dark:bg-coolgray-200 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button type="button" 
                                wire:click="confirm"
                                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 
                                       bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none 
                                       focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                            Confirm & Continue
                        </button>
                        <button type="button" 
                                wire:click="close"
                                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-coolgray-300 
                                       shadow-sm px-4 py-2 bg-white dark:bg-coolgray-100 text-base font-medium text-gray-700 dark:text-gray-300 
                                       hover:bg-gray-50 dark:hover:bg-coolgray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 
                                       focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    @endif
</div>
