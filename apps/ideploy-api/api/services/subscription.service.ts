/**
 * SaaS subscription + quotas + Stripe. Ports IdemSubscriptionService /
 * IdemQuotaService / IdemStripeService. The team's plan + limits live on the
 * `teams` table (idem_subscription_plan, idem_app_limit, custom_server_limit,
 * stripe_customer_id, stripe_subscription_id).
 *
 * Stripe calls use the REST API via axios (no SDK dependency); guarded by
 * STRIPE_SECRET_KEY.
 */
import axios from 'axios';
import pool from '../config/db.config';

export async function listPlans(): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT name, display_name, price, currency, billing_period, app_limit, server_limit, features, is_active, sort_order
     FROM idem_subscription_plans WHERE is_active = true ORDER BY sort_order`
  );
  return rows;
}

export interface Subscription {
  plan: string;
  appLimit: number;
  serverLimit: number;
  expiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export async function getSubscription(teamId: number): Promise<Subscription> {
  const { rows } = await pool.query(
    `SELECT idem_subscription_plan, idem_app_limit, custom_server_limit,
            idem_subscription_expires_at, stripe_customer_id, stripe_subscription_id
     FROM teams WHERE id = $1 LIMIT 1`,
    [teamId]
  );
  const r = rows[0] ?? {};
  return {
    plan: String(r.idem_subscription_plan ?? 'free'),
    appLimit: Number(r.idem_app_limit ?? 0),
    serverLimit: Number(r.custom_server_limit ?? 0),
    expiresAt: r.idem_subscription_expires_at ? String(r.idem_subscription_expires_at) : null,
    stripeCustomerId: r.stripe_customer_id ? String(r.stripe_customer_id) : null,
    stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
  };
}

export interface Quota {
  apps: { used: number; limit: number; ok: boolean };
  servers: { used: number; limit: number; ok: boolean };
}

/** Current usage vs plan limits (limit 0 = unlimited). */
export async function getQuota(teamId: number): Promise<Quota> {
  const sub = await getSubscription(teamId);
  const appCount = await pool.query(
    `SELECT count(*)::int AS n FROM applications a
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id WHERE p.team_id = $1`,
    [teamId]
  );
  const serverCount = await pool.query('SELECT count(*)::int AS n FROM servers WHERE team_id = $1', [teamId]);
  const apps = Number(appCount.rows[0].n);
  const servers = Number(serverCount.rows[0].n);
  return {
    apps: { used: apps, limit: sub.appLimit, ok: sub.appLimit === 0 || apps < sub.appLimit },
    servers: { used: servers, limit: sub.serverLimit, ok: sub.serverLimit === 0 || servers < sub.serverLimit },
  };
}

/** Admin/override: change a team's plan + limits directly. */
export async function changePlan(
  teamId: number,
  plan: string,
  limits?: { appLimit?: number; serverLimit?: number }
): Promise<Subscription> {
  await pool.query(
    `UPDATE teams SET idem_subscription_plan = $1,
       idem_app_limit = COALESCE($2, idem_app_limit),
       custom_server_limit = COALESCE($3, custom_server_limit),
       updated_at = now()
     WHERE id = $4`,
    [plan, limits?.appLimit ?? null, limits?.serverLimit ?? null, teamId]
  );
  return getSubscription(teamId);
}

// ── Stripe (REST via axios) ───────────────────────────────
function stripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  return key;
}

function stripeForm(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/** Create a Stripe Checkout session for a plan price. Returns the checkout URL. */
export async function createCheckout(
  teamId: number,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string }> {
  const sub = await getSubscription(teamId);
  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[team_id]': String(teamId),
  };
  if (sub.stripeCustomerId) params.customer = sub.stripeCustomerId;

  const { data } = await axios.post('https://api.stripe.com/v1/checkout/sessions', stripeForm(params), {
    headers: { Authorization: `Bearer ${stripeKey()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  return { url: data.url };
}

/** Create a Stripe billing portal session. */
export async function createPortal(teamId: number, returnUrl: string): Promise<{ url: string }> {
  const sub = await getSubscription(teamId);
  if (!sub.stripeCustomerId) throw new Error('No Stripe customer for this team');
  const { data } = await axios.post(
    'https://api.stripe.com/v1/billing_portal/sessions',
    stripeForm({ customer: sub.stripeCustomerId, return_url: returnUrl }),
    {
      headers: { Authorization: `Bearer ${stripeKey()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );
  return { url: data.url };
}

/** Cancel the team's Stripe subscription at period end. */
export async function cancelSubscription(teamId: number): Promise<{ cancelled: boolean }> {
  const sub = await getSubscription(teamId);
  if (!sub.stripeSubscriptionId) throw new Error('No active subscription');
  await axios.post(
    `https://api.stripe.com/v1/subscriptions/${sub.stripeSubscriptionId}`,
    stripeForm({ cancel_at_period_end: 'true' }),
    {
      headers: { Authorization: `Bearer ${stripeKey()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    }
  );
  return { cancelled: true };
}
