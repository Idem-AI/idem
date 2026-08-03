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

/**
 * Sentinel for "no limit", matching the Laravel side (`hasUnlimitedApps()` tests
 * `app_limit === -1`). Getting this wrong is not cosmetic: treating the wrong
 * value as unlimited either blocks a paying customer or lets a free one deploy
 * without bound.
 */
export const UNLIMITED = -1;

export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED;
}

/** True when `used` is still within `limit`. */
export function withinLimit(used: number, limit: number): boolean {
  return isUnlimited(limit) || used < limit;
}

export async function listPlans(): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT name, display_name, price, currency, billing_period, app_limit, server_limit,
            features, allows_region_selection, is_active, sort_order
     FROM idem_subscription_plans WHERE is_active = true ORDER BY sort_order`
  );
  return rows;
}

export interface Subscription {
  plan: string;
  /** `UNLIMITED` (-1) means no cap. */
  appLimit: number;
  /** `UNLIMITED` (-1) means no cap. */
  serverLimit: number;
  /** Whether a workspace on this plan may choose its hosting region. */
  allowsRegionSelection: boolean;
  expiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/** Used only when the team's plan has no row in `idem_subscription_plans`. */
const FALLBACK_LIMITS = { appLimit: 5, serverLimit: 2 };

/**
 * The team's effective subscription.
 *
 * **Limits come from the plan row**, which is the source of truth the Laravel
 * side reads (`IdemQuotaService` consults `$plan->app_limit` and never the team
 * columns). Reading them from `teams` instead — as this did previously — was
 * wrong twice over: `custom_server_limit` is NULL for most teams, which collapsed
 * to 0 and was then read as "no cap", granting every free team unlimited servers.
 *
 * `teams.custom_server_limit` *is* honoured as a per-team override, because it is
 * nullable with no default: a value there can only have been set deliberately.
 * `teams.idem_app_limit` is deliberately ignored — it carries a column default of
 * 2, so a stored value cannot be distinguished from "never configured", and
 * trusting it would silently cap enterprise teams at 2 applications.
 */
export async function getSubscription(teamId: number): Promise<Subscription> {
  const { rows } = await pool.query(
    `SELECT t.idem_subscription_plan,
            t.custom_server_limit,
            t.idem_subscription_expires_at,
            t.stripe_customer_id,
            t.stripe_subscription_id,
            p.app_limit               AS plan_app_limit,
            p.server_limit            AS plan_server_limit,
            p.allows_region_selection AS plan_allows_region_selection
     FROM teams t
     LEFT JOIN idem_subscription_plans p
            ON p.name = COALESCE(t.idem_subscription_plan, 'free')
     WHERE t.id = $1
     LIMIT 1`,
    [teamId]
  );
  const r = rows[0] ?? {};

  const appLimit = numberOr(r.plan_app_limit, FALLBACK_LIMITS.appLimit);
  const serverLimit = numberOr(
    // Explicit per-team override first, then the plan.
    r.custom_server_limit ?? r.plan_server_limit,
    FALLBACK_LIMITS.serverLimit
  );

  return {
    plan: String(r.idem_subscription_plan ?? 'free'),
    appLimit,
    serverLimit,
    allowsRegionSelection: Boolean(r.plan_allows_region_selection),
    expiresAt: r.idem_subscription_expires_at ? String(r.idem_subscription_expires_at) : null,
    stripeCustomerId: r.stripe_customer_id ? String(r.stripe_customer_id) : null,
    stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
  };
}

/** Coerce to a number, falling back when the value is absent. */
function numberOr(value: unknown, fallback: number): number {
  return value === null || value === undefined ? fallback : Number(value);
}

export interface Quota {
  apps: { used: number; limit: number; ok: boolean };
  servers: { used: number; limit: number; ok: boolean };
}

/** Current usage against the plan's limits. */
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
    apps: { used: apps, limit: sub.appLimit, ok: withinLimit(apps, sub.appLimit) },
    servers: { used: servers, limit: sub.serverLimit, ok: withinLimit(servers, sub.serverLimit) },
  };
}

/**
 * May this team pick where its workspaces are hosted?
 *
 * Region choice is a paid capability; free and basic deploy to the default
 * region. Driven by the plan row rather than a list of plan names in code, so
 * repricing does not mean a deploy.
 */
export async function canSelectRegion(teamId: number): Promise<boolean> {
  return (await getSubscription(teamId)).allowsRegionSelection;
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
