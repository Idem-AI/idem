<?php

/**
 * IDEM SaaS Web Routes
 * 
 * Routes pour les fonctionnalités IDEM SaaS:
 * - Subscription Dashboard (Client)
 * - Plans Page
 * - Admin Dashboard
 */

use Illuminate\Support\Facades\Route;
use App\Livewire\Idem\SubscriptionDashboard;
use App\Livewire\Idem\AdminDashboard;
use App\Models\IdemSubscriptionPlan;

// ============================================
// IDEM Client Routes (Subscription)
// ============================================

Route::middleware(['auth'])->prefix('idem')->name('idem.')->group(function () {
    
    // Subscription Dashboard
    Route::get('/subscription', SubscriptionDashboard::class)
        ->name('subscription');
    
    // Plans Page
    Route::get('/plans', function () {
        $plans = IdemSubscriptionPlan::where('is_active', true)
            ->orderBy('price')
            ->get();
        
        return view('idem.plans', [
            'plans' => $plans
        ]);
    })->name('plans');
    
    // Checkout Page (if Stripe enabled)
    Route::get('/checkout/{plan}', function ($planName) {
        $plan = IdemSubscriptionPlan::where('name', $planName)
            ->where('is_active', true)
            ->firstOrFail();
        
        return view('idem.checkout', [
            'plan' => $plan
        ]);
    })->name('checkout');
});

// ============================================
// IDEM Admin Routes
// ============================================

Route::middleware(['auth', 'idem.admin'])
    ->prefix('idem/admin')
    ->name('idem.admin.')
    ->group(function () {
    
    // Admin Dashboard (Legacy)
    Route::get('/dashboard', AdminDashboard::class)
        ->name('dashboard');
    
    // Admin Panel (New Unified Interface)
    Route::get('/panel', \App\Livewire\Idem\AdminPanel::class)
        ->name('panel');
    
    // User Management
    Route::get('/users', \App\Livewire\Idem\Admin\UserManagement::class)
        ->name('users');
    
    // Team Management
    Route::get('/teams', \App\Livewire\Idem\Admin\TeamManagement::class)
        ->name('teams');
    
    // Server Management
    Route::get('/servers', \App\Livewire\Idem\Admin\ServerManagement::class)
        ->name('servers');
});
