<?php

namespace App\Livewire;

use Livewire\Component;

class Landing extends Component
{
    public function mount()
    {
        if (auth()->check()) {
            return redirect()->route('dashboard');
        }
    }

    public function render()
    {
        return view('livewire.landing')->layout('layouts.simple');
    }
}
