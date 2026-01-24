<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\IdemStripeService;
use Illuminate\Support\Facades\Log;

class IdemStripeController extends Controller
{
    protected IdemStripeService $stripeService;

    public function __construct(IdemStripeService $stripeService)
    {
        $this->stripeService = $stripeService;
    }

    /**
     * Create checkout session for plan upgrade
     */
    public function createCheckoutSession(Request $request): JsonResponse
    {
        $request->validate([
            'plan' => 'required|string|in:basic,pro,enterprise',
        ]);

        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        // Check if user is owner or admin
        $userRole = $team->members->where('id', $request->user()->id)->first()?->pivot->role;
        
        if (!in_array($userRole, ['owner', 'admin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Seuls les propriétaires et administrateurs peuvent changer le plan.',
            ], 403);
        }

        $result = $this->stripeService->createCheckoutSession($team, $request->plan);

        return response()->json($result, $result['success'] ? 200 : 400);
    }

    /**
     * Handle successful checkout redirect
     */
    public function checkoutSuccess(Request $request): JsonResponse
    {
        $sessionId = $request->query('session_id');

        if (!$sessionId) {
            return response()->json([
                'success' => false,
                'message' => 'Session ID manquant.',
            ], 400);
        }

        $result = $this->stripeService->handleCheckoutSuccess($sessionId);

        return response()->json($result, $result['success'] ? 200 : 400);
    }

    /**
     * Cancel subscription
     */
    public function cancelSubscription(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team) {
            return response()->json([
                'success' => false,
                'message' => 'Équipe introuvable.',
            ], 404);
        }

        // Check if user is owner
        $userRole = $team->members->where('id', $request->user()->id)->first()?->pivot->role;
        
        if ($userRole !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'Seul le propriétaire peut annuler l\'abonnement.',
            ], 403);
        }

        $result = $this->stripeService->cancelSubscription($team);

        return response()->json($result, $result['success'] ? 200 : 400);
    }

    /**
     * Handle Stripe webhooks
     */
    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->all();
        $signature = $request->header('Stripe-Signature');

        // Verify webhook signature
        if (config('idem.stripe.webhook_secret')) {
            try {
                \Stripe\Webhook::constructEvent(
                    $request->getContent(),
                    $signature,
                    config('idem.stripe.webhook_secret')
                );
            } catch (\Exception $e) {
                Log::error('Stripe webhook signature verification failed', [
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Invalid signature',
                ], 400);
            }
        }

        try {
            $this->stripeService->handleWebhook($payload);

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Stripe webhook handling failed', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get Stripe customer portal URL
     */
    public function createPortalSession(Request $request): JsonResponse
    {
        $team = $request->user()->currentTeam();

        if (!$team || !$team->stripe_customer_id) {
            return response()->json([
                'success' => false,
                'message' => 'Aucun client Stripe trouvé.',
            ], 404);
        }

        try {
            \Stripe\Stripe::setApiKey(config('idem.stripe.secret'));
            
            $session = \Stripe\BillingPortal\Session::create([
                'customer' => $team->stripe_customer_id,
                'return_url' => url('/idem/subscription'),
            ]);

            return response()->json([
                'success' => true,
                'url' => $session->url,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la création de la session: ' . $e->getMessage(),
            ], 500);
        }
    }
}
