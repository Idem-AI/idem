<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RedirectAuthToMainDashboard
{
    /**
     * Handle an incoming request.
     * Redirects login, register, and forgot-password pages to main-dashboard.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $dashboardUrl = rtrim(config('idem.dashboard_url', env('IDEM_DASHBOARD_URL', 'http://localhost:4200')), '/');
        
        // Redirect login page
        if ($request->is('login')) {
            return redirect()->away("{$dashboardUrl}/login?redirect=ideploy");
        }

        // Redirect register page
        if ($request->is('register')) {
            return redirect()->away("{$dashboardUrl}/login?redirect=ideploy");
        }

        // Redirect forgot-password page
        if ($request->is('forgot-password')) {
            return redirect()->away("{$dashboardUrl}/login?redirect=ideploy");
        }

        return $next($request);
    }
}
