@extends('layouts.base')
@section('body')
    @parent
    {{-- IDEM: Popups désactivés
    @if (isSubscribed() || !isCloud())
        <livewire:layout-popups />
    @endif
    --}}
    <!-- Global search component - included once to prevent keyboard shortcut duplication -->
    <livewire:global-search />
    @auth
        <livewire:deployments-indicator />
        <div x-data="{
            open: false,
            pageWidth: 'full',
            init() {
                this.pageWidth = localStorage.getItem('pageWidth') || 'full';
                if (!localStorage.getItem('pageWidth')) {
                    localStorage.setItem('pageWidth', 'full');
                }
            }
        }" class="mx-auto" :class="pageWidth === 'full' ? '' : 'max-w-7xl'">
            <div class="relative z-50 lg:hidden" :class="open ? 'block' : 'hidden'" role="dialog" aria-modal="true">
                <div class="fixed inset-0 bg-black/80" x-on:click="open = false"></div>
                <div class="fixed inset-y-0 right-0 h-full flex">
                    <div class="relative flex flex-1 w-full max-w-64">
                        <div class="absolute top-0 flex justify-center w-16 pt-5 right-full">
                            <button type="button" class="-m-2.5 p-2.5" x-on:click="open = !open">
                                <span class="sr-only">Close sidebar</span>
                                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                                    stroke="currentColor" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div class="flex flex-col pb-2 overflow-y-auto min-w-64 gap-y-5" style="scrollbar-width: none; -ms-overflow-style: none;">
                            <x-navbar-modern />
                        </div>
                    </div>
                </div>
            </div>

            {{-- Top Navbar --}}
            <div class="hidden lg:block lg:fixed lg:top-0 lg:left-0 lg:right-0 lg:z-50 lg:h-16">
                <x-navbar-topbar />
            </div>

            {{-- Sidebar --}}
            <div class="hidden lg:fixed lg:top-16 lg:bottom-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
                <div class="flex flex-col overflow-y-auto grow" style="scrollbar-width: none; -ms-overflow-style: none;">
                    <style>
                        /* Cacher scrollbar violet */
                        .flex.flex-col.overflow-y-auto::-webkit-scrollbar {
                            display: none;
                        }
                    </style>
                    <x-navbar-modern />
                </div>
            </div>

            {{-- Mobile Header --}}
            <div class="sticky top-0 z-40 flex items-center justify-between px-4 h-14 gap-x-6 sm:px-6 lg:hidden bg-[#080c18] border-b border-white/[0.06]">
                <div class="flex items-center gap-3 flex-shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-md flex items-center justify-center" style="background: linear-gradient(135deg, #3b82f6, #8b5cf6);">
                            <span class="text-[10px] font-black text-white">ID</span>
                        </div>
                        <span class="text-sm font-bold text-white">Idem</span>
                    </div>
                    <livewire:switch-team />
                </div>
                <button type="button" class="-m-2.5 p-2.5 dark:text-warning" x-on:click="open = !open">
                    <span class="sr-only">Open sidebar</span>
                    <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24">
                        <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
                            stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            <main class="lg:pl-64 lg:pt-16">
                <div class="p-4 sm:px-6 lg:px-8 lg:py-6">
                    {{ $slot }}
                </div>
            </main>
        </div>
    @endauth
@endsection
