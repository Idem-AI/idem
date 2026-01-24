<?php

namespace App\Services;

use App\Models\Team;
use App\Models\IdemSubscriptionPlan;
use Stripe\Stripe;
use Stripe\Checkout\Session;
use Stripe\Subscription;
use Stripe\Customer;
use Illuminate\Support\Facades\Log;

class IdemStripeService
{
    protected IdemSubscriptionService $subscriptionService;

    public function __construct(IdemSubscriptionService $subscriptionService)
    {
        $this->subscriptionService = $subscriptionService;
        
        if (config('idem.stripe.enabled')) {
            Stripe::setApiKey(config('idem.stripe.secret'));
        }
    }

    /**
     * Create Stripe checkout session for plan upgrade
     */
    public function createCheckoutSession(Team $team, string $planName): array
    {
        if (!config('idem.stripe.enabled')) {
            return [
                'success' => false,
                'message' => 'Stripe n\'est pas activé.',
            ];
        }

        $plan = IdemSubscriptionPlan::findByName($planName);
        
        if (!$plan || $plan->isFree()) {
            return [
                'success' => false,
                'message' => 'Plan invalide ou gratuit.',
            ];
        }

        try {
            // Get or create Stripe customer
            $customer = $this->getOrCreateCustomer($team);

            // Get price ID for plan
            $priceId = $this->getPriceId($planName);
            
            if (!$priceId) {
                return [
                    'success' => false,
                    'message' => 'Prix Stripe non configuré pour ce plan.',
                ];
            }

            // Create checkout session
            $session = Session::create([
                'customer' => $customer->id,
                'payment_method_types' => ['card'],
                'line_items' => [[
                    'price' => $priceId,
                    'quantity' => 1,
                ]],
                'mode' => 'subscription',
                'success_url' => url('/idem/subscription/success?session_id={CHECKOUT_SESSION_ID}'),
                'cancel_url' => url('/idem/subscription'),
                'metadata' => [
                    'team_id' => $team->id,
                    'plan_name' => $planName,
                ],
            ]);

            return [
                'success' => true,
                'session_id' => $session->id,
                'checkout_url' => $session->url,
            ];
        } catch (\Exception $e) {
            Log::error('Stripe checkout session creation failed', [
                'team_id' => $team->id,
                'plan' => $planName,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de la création de la session de paiement: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Handle successful checkout
     */
    public function handleCheckoutSuccess(string $sessionId): array
    {
        try {
            $session = Session::retrieve($sessionId);
            
            $teamId = $session->metadata->team_id;
            $planName = $session->metadata->plan_name;
            
            $team = Team::find($teamId);
            
            if (!$team) {
                throw new \Exception('Team not found');
            }

            // Update team subscription
            $result = $this->subscriptionService->changePlan($team, $planName);
            
            if ($result['success']) {
                // Store Stripe subscription ID
                $team->update([
                    'stripe_subscription_id' => $session->subscription,
                    'stripe_customer_id' => $session->customer,
                ]);
            }

            return $result;
        } catch (\Exception $e) {
            Log::error('Stripe checkout success handling failed', [
                'session_id' => $sessionId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors du traitement du paiement: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Handle webhook events
     */
    public function handleWebhook(array $payload): void
    {
        $event = $payload['type'];

        switch ($event) {
            case 'checkout.session.completed':
                $this->handleCheckoutCompleted($payload['data']['object']);
                break;
                
            case 'customer.subscription.updated':
                $this->handleSubscriptionUpdated($payload['data']['object']);
                break;
                
            case 'customer.subscription.deleted':
                $this->handleSubscriptionCanceled($payload['data']['object']);
                break;
                
            case 'invoice.payment_failed':
                $this->handlePaymentFailed($payload['data']['object']);
                break;
        }
    }

    /**
     * Cancel Stripe subscription
     */
    public function cancelSubscription(Team $team): array
    {
        if (!$team->stripe_subscription_id) {
            return [
                'success' => false,
                'message' => 'Aucun abonnement Stripe trouvé.',
            ];
        }

        try {
            $subscription = Subscription::retrieve($team->stripe_subscription_id);
            $subscription->cancel();

            // Revert to free plan
            $result = $this->subscriptionService->cancelSubscription($team);

            $team->update([
                'stripe_subscription_id' => null,
            ]);

            return $result;
        } catch (\Exception $e) {
            Log::error('Stripe subscription cancellation failed', [
                'team_id' => $team->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'message' => 'Erreur lors de l\'annulation: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get or create Stripe customer
     */
    protected function getOrCreateCustomer(Team $team): Customer
    {
        if ($team->stripe_customer_id) {
            try {
                return Customer::retrieve($team->stripe_customer_id);
            } catch (\Exception $e) {
                // Customer doesn't exist, create new one
            }
        }

        $owner = $team->members()->wherePivot('role', 'owner')->first();
        
        $customer = Customer::create([
            'email' => $owner->email ?? 'team-' . $team->id . '@example.com',
            'name' => $team->name,
            'metadata' => [
                'team_id' => $team->id,
            ],
        ]);

        $team->update(['stripe_customer_id' => $customer->id]);

        return $customer;
    }

    /**
     * Get Stripe price ID for plan
     */
    protected function getPriceId(string $planName): ?string
    {
        return match($planName) {
            'basic' => config('idem.stripe.price_ids.basic_monthly'),
            'pro' => config('idem.stripe.price_ids.pro_monthly'),
            'enterprise' => config('idem.stripe.price_ids.enterprise_monthly'),
            default => null,
        };
    }

    /**
     * Handle checkout completed event
     */
    protected function handleCheckoutCompleted(array $session): void
    {
        $teamId = $session['metadata']['team_id'] ?? null;
        $planName = $session['metadata']['plan_name'] ?? null;
        
        if ($teamId && $planName) {
            $team = Team::find($teamId);
            if ($team) {
                $this->subscriptionService->changePlan($team, $planName);
            }
        }
    }

    /**
     * Handle subscription updated event
     */
    protected function handleSubscriptionUpdated(array $subscription): void
    {
        $customerId = $subscription['customer'];
        $team = Team::where('stripe_customer_id', $customerId)->first();
        
        if ($team) {
            // Update subscription status if needed
            Log::info('Subscription updated for team', ['team_id' => $team->id]);
        }
    }

    /**
     * Handle subscription canceled event
     */
    protected function handleSubscriptionCanceled(array $subscription): void
    {
        $customerId = $subscription['customer'];
        $team = Team::where('stripe_customer_id', $customerId)->first();
        
        if ($team) {
            $this->subscriptionService->cancelSubscription($team);
            $team->update(['stripe_subscription_id' => null]);
            
            Log::info('Subscription canceled for team', ['team_id' => $team->id]);
        }
    }

    /**
     * Handle payment failed event
     */
    protected function handlePaymentFailed(array $invoice): void
    {
        $customerId = $invoice['customer'];
        $team = Team::where('stripe_customer_id', $customerId)->first();
        
        if ($team) {
            // Send notification about payment failure
            Log::warning('Payment failed for team', [
                'team_id' => $team->id,
                'invoice_id' => $invoice['id'],
            ]);
            
            // TODO: Send email notification
        }
    }
}
