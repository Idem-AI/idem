<?php

namespace App\Livewire;

use Livewire\Component;

class Landing extends Component
{
    public function logout()
    {
        auth()->logout();
        session()->invalidate();
        session()->regenerateToken();

        return redirect()->route('landing');
    }

    public function render()
    {
        return view('livewire.landing')->layout('layouts.simple');
    }
}
