<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WelcomeController extends Controller
{
    /**
     * Page d'accueil - Affiche la page de vérification
     * La vérification se fait côté client via JavaScript
     */
    public function index(Request $request)
    {
        return view('welcome', [
            'authUrl' => config('idem.dashboard_url', 'http://localhost:4200'),
            'apiUrl' => config('idem.api_url', 'http://localhost:3001'),
        ]);
    }
}
