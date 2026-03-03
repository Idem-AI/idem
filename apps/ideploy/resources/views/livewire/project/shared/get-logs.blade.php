<div class="section-card my-4">
    <div x-init="$wire.getLogs" id="screen" x-data="{
        fullscreen: false,
        alwaysScroll: false,
        intervalId: null,
        makeFullscreen() {
            this.fullscreen = !this.fullscreen;
            if (this.fullscreen === false) {
                this.alwaysScroll = false;
                clearInterval(this.intervalId);
            }
        },
        toggleScroll() {
            this.alwaysScroll = !this.alwaysScroll;
    
            if (this.alwaysScroll) {
                this.intervalId = setInterval(() => {
                    const screen = document.getElementById('screen');
                    const logs = document.getElementById('logs');
                    if (screen.scrollTop !== logs.scrollHeight) {
                        screen.scrollTop = logs.scrollHeight;
                    }
                }, 100);
            } else {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        },
        goTop() {
            this.alwaysScroll = false;
            clearInterval(this.intervalId);
            const screen = document.getElementById('screen');
            screen.scrollTop = 0;
        }
    }">
        <div class="flex gap-3 items-center mb-4">
            <span class="category-badge">Container</span>
            @if ($resource?->type() === 'application' || str($resource?->type())->startsWith('standalone'))
                <h4 class="text-lg font-semibold text-light">{{ $container }}</h4>
            @else
                <h4 class="text-lg font-semibold text-light">{{ str($container)->beforeLast('-')->headline() }}</h4>
            @endif
            @if ($pull_request)
                <span class="info-badge">PR #{{ $pull_request }}</span>
            @endif
            @if ($streamLogs)
                <div class="flex items-center gap-2 text-accent">
                    <div class="spinner-modern"></div>
                    <span class="text-sm">Streaming...</span>
                </div>
            @endif
        </div>
        <form wire:submit='getLogs(true)' class="flex gap-2 items-end">
            <div class="w-96">
                <x-forms.input label="Only Show Number of Lines" placeholder="100" type="number" required
                    id="numberOfLines" :readonly="$streamLogs"></x-forms.input>
            </div>
            <button type="submit" class="inner-button">
                <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
            </button>
            <x-forms.checkbox instantSave label="Stream Logs" id="streamLogs"></x-forms.checkbox>
            <x-forms.checkbox instantSave label="Include Timestamps" id="showTimeStamps"></x-forms.checkbox>
        </form>
        <div :class="fullscreen ? 'fullscreen' : 'relative w-full py-4 mx-auto'">
            <div class="flex overflow-y-auto flex-col-reverse px-4 py-3 w-full bg-black/40 text-light font-mono scrollbar border border-white/10 backdrop-blur-sm"
                :class="fullscreen ? '' : 'max-h-96 rounded-lg'" style="background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(10, 15, 20, 0.5));">
                <div :class="fullscreen ? 'fixed top-4 right-4' : 'absolute top-6 right-0'">
                    <div class="flex justify-end gap-4" :class="fullscreen ? 'fixed' : ''"
                        style="transform: translateX(-100%)">
                        {{-- <button title="Go Top" x-show="fullscreen" x-on:click="goTop">
                            <svg class="w-5 h-5 opacity-30 hover:opacity-100" viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg">
                                <path fill="none" stroke="currentColor" stroke-linecap="round"
                                    stroke-linejoin="round" stroke-width="2" d="M12 5v14m4-10l-4-4M8 9l4-4" />
                            </svg>
                        </button>
                        <button title="Follow Logs" x-show="fullscreen" :class="alwaysScroll ? 'dark:text-warning' : ''"
                            x-on:click="toggleScroll">
                            <svg class="w-5 h-5 opacity-30 hover:opacity-100" viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg">
                                <path fill="none" stroke="currentColor" stroke-linecap="round"
                                    stroke-linejoin="round" stroke-width="2" d="M12 5v14m4-4l-4 4m-4-4l4 4" />
                            </svg>
                        </button> --}}
                        <button title="Fullscreen" x-show="!fullscreen" x-on:click="makeFullscreen">
                            <svg class="w-5 h-5 opacity-30 hover:opacity-100" viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg">
                                <g fill="none">
                                    <path
                                        d="M24 0v24H0V0h24ZM12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035c-.01-.004-.019-.001-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427c-.002-.01-.009-.017-.017-.018Zm.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093c.012.004.023 0 .029-.008l.004-.014l-.034-.614c-.003-.012-.01-.02-.02-.022Zm-.715.002a.023.023 0 0 0-.027.006l-.006.014l-.034.614c0 .012.007.02.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01l-.184-.092Z" />
                                    <path fill="currentColor"
                                        d="M9.793 12.793a1 1 0 0 1 1.497 1.32l-.083.094L6.414 19H9a1 1 0 0 1 .117 1.993L9 21H4a1 1 0 0 1-.993-.883L3 20v-5a1 1 0 0 1 1.993-.117L5 15v2.586l4.793-4.793ZM20 3a1 1 0 0 1 .993.883L21 4v5a1 1 0 0 1-1.993.117L19 9V6.414l-4.793 4.793a1 1 0 0 1-1.497-1.32l.083-.094L17.586 5H15a1 1 0 0 1-.117-1.993L15 3h5Z" />
                                </g>
                            </svg>
                        </button>
                        <button title="Minimize" x-show="fullscreen" x-on:click="makeFullscreen">
                            <svg class="w-5 h-5 opacity-30 hover:opacity-100"
                                viewBox="0 0 24 24"xmlns="http://www.w3.org/2000/svg">
                                <path fill="none" stroke="currentColor" stroke-linecap="round"
                                    stroke-linejoin="round" stroke-width="2"
                                    d="M6 14h4m0 0v4m0-4l-6 6m14-10h-4m0 0V6m0 4l6-6" />
                            </svg>
                        </button>
                    </div>
                </div>
                @if ($outputs)
                    <pre id="logs" class="font-mono whitespace-pre-wrap">{{ $outputs }}</pre>
                @else
                    <pre id="logs" class="font-mono whitespace-pre-wrap">Refresh to get the logs...</pre>
                @endif
            </div>
        </div>
    </div>
</div>
