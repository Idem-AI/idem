/**
 * Les indicateurs du plan (§12), lus en base pour la console d'idem-admin : de quoi savoir si la
 * stratégie multi-fournisseurs améliore vraiment la rentabilité.
 */
import { one, query } from '../../config/db';
import { minimumPriceXaf } from '../pricing/engine';
import { activeRules } from '../pricing/rules.service';

export async function dashboard(days = 30) {
  const since = `now() - make_interval(days => $1)`;
  const [searches, orders, perTld, perProvider, activation, dns, failures, domains] = await Promise.all([
    one<{ searches: string }>(`SELECT count(DISTINCT domain_name) AS searches FROM provider_price_quotes WHERE context = 'search' AND created_at > ${since}`, [days]),
    one<{ orders: string; paid: string; completed: string; revenue: string; margin: string; on_hold: string; needs_review: string }>(
      `SELECT count(DISTINCT o.id) AS orders,
              count(DISTINCT o.id) FILTER (WHERE o.status NOT IN ('awaiting_payment', 'awaiting_contact', 'cancelled')) AS paid,
              count(DISTINCT o.id) FILTER (WHERE o.status = 'completed') AS completed,
              COALESCE(sum(oi.price_xaf) FILTER (WHERE oi.status = 'registered'), 0) AS revenue,
              COALESCE(sum(oi.margin_xaf) FILTER (WHERE oi.status = 'registered'), 0) AS margin,
              count(DISTINCT o.id) FILTER (WHERE o.status = 'on_hold') AS on_hold,
              count(DISTINCT o.id) FILTER (WHERE o.status = 'needs_review') AS needs_review
         FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.created_at > ${since}`,
      [days]
    ),
    query<{ tld: string; sold: string; avg_cost_xaf: string; avg_margin_xaf: string; revenue: string }>(
      `SELECT tld, count(*) AS sold, round(avg(provider_cost_xaf)) AS avg_cost_xaf, round(avg(margin_xaf)) AS avg_margin_xaf, sum(price_xaf) AS revenue
         FROM order_items WHERE status = 'registered' AND created_at > ${since} GROUP BY tld ORDER BY sold DESC`,
      [days]
    ),
    query<{ provider_code: string; sold: string; avg_margin_xaf: string; savings_vs_second_xaf: string }>(
      `SELECT provider_code, count(*) AS sold, round(avg(margin_xaf)) AS avg_margin_xaf,
              COALESCE(sum(second_cost_xaf - provider_cost_xaf) FILTER (WHERE second_cost_xaf IS NOT NULL), 0) AS savings_vs_second_xaf
         FROM order_items WHERE status = 'registered' AND created_at > ${since} GROUP BY provider_code`,
      [days]
    ),
    one<{ avg_minutes: string | null }>(
      `SELECT round(avg(EXTRACT(EPOCH FROM (c.activated_at - p.created_at)) / 60)) AS avg_minutes
         FROM domain_connections c JOIN order_items oi ON oi.domain_name = c.host AND oi.status = 'registered'
         JOIN payments p ON p.order_id = oi.order_id AND p.kind = 'charge' AND p.status = 'succeeded'
        WHERE c.activated_at IS NOT NULL AND c.created_at > ${since}`,
      [days]
    ),
    one<{ managed: string; managed_active: string }>(
      `SELECT count(*) FILTER (WHERE dns_method = 'managed') AS managed, count(*) FILTER (WHERE dns_method = 'managed' AND status = 'active') AS managed_active
         FROM domain_connections WHERE created_at > ${since}`,
      [days]
    ),
    one<{ attempts: string; failed: string }>(`SELECT count(*) AS attempts, count(*) FILTER (WHERE status = 'failed') AS failed FROM domain_operations WHERE kind = 'register' AND created_at > ${since}`, [days]),
    query<{ registrar_code: string; active: string }>(`SELECT registrar_code, count(*) AS active FROM domains WHERE status = 'active' GROUP BY registrar_code`),
  ]);
  const n = (v: string | null | undefined) => Number(v ?? 0);
  return {
    periodDays: days,
    conversion: { searches: n(searches?.searches), paidOrders: n(orders?.paid), rate: n(searches?.searches) ? n(orders?.paid) / n(searches?.searches) : null },
    orders: { total: n(orders?.orders), completed: n(orders?.completed), onHold: n(orders?.on_hold), needsReview: n(orders?.needs_review) },
    money: { revenueXaf: n(orders?.revenue), grossMarginXaf: n(orders?.margin) },
    perTld: perTld.map((r) => ({ tld: r.tld, sold: n(r.sold), avgCostXaf: n(r.avg_cost_xaf), avgMarginXaf: n(r.avg_margin_xaf), revenueXaf: n(r.revenue) })),
    perProvider: perProvider.map((r) => ({ provider: r.provider_code, sold: n(r.sold), avgMarginXaf: n(r.avg_margin_xaf), savingsVsSecondXaf: n(r.savings_vs_second_xaf) })),
    registrationFailureRate: n(failures?.attempts) ? n(failures?.failed) / n(failures?.attempts) : null,
    avgPaymentToActiveMinutes: activation?.avg_minutes !== null && activation?.avg_minutes !== undefined ? n(activation.avg_minutes) : null,
    automaticDnsSuccessRate: n(dns?.managed) ? n(dns?.managed_active) / n(dns?.managed) : null,
    activeDomainsPerProvider: domains.map((d) => ({ provider: d.registrar_code, active: n(d.active) })),
  };
}

/** Par extension : prix public, coûts de chaque fournisseur, P_min et marge prévisionnelle. */
export async function pricingGrid() {
  const { rules } = await activeRules();
  const rows = await query<{ tld: string; register_xaf: number | null; renew_xaf: number | null; pack_xaf: number | null; on_sale: boolean; costs: { provider: string; operation: string; cost: string; currency: string; source: string; fetched_at: string; xaf: string | null }[] | null }>(
    `SELECT c.tld, c.register_xaf, c.renew_xaf, c.pack_xaf, c.on_sale,
            (SELECT json_agg(json_build_object('provider', pc.provider_code, 'operation', pc.operation, 'cost', pc.cost, 'currency', pc.currency, 'source', pc.source, 'fetched_at', pc.fetched_at,
                                               'xaf', round(pc.cost * fx.xaf_per_unit)))
               FROM provider_costs pc LEFT JOIN fx_rates fx ON fx.currency = pc.currency WHERE pc.tld = c.tld AND pc.years = 1) AS costs
       FROM public_price_catalog c WHERE c.valid_to IS NULL ORDER BY c.tld`
  );
  return rows.map((r) => {
    const registerCosts = (r.costs ?? []).filter((c) => c.operation === 'register' && c.xaf !== null).map((c) => Number(c.xaf));
    const cheapest = registerCosts.length ? Math.min(...registerCosts) : null;
    return {
      tld: r.tld,
      onSale: r.on_sale,
      prices: { registerXaf: r.register_xaf, renewXaf: r.renew_xaf, packXaf: r.pack_xaf },
      costs: r.costs ?? [],
      cheapestRegisterCostXaf: cheapest,
      minimumRegisterPriceXaf: cheapest !== null ? minimumPriceXaf(cheapest, rules) : null,
      forecastMarginXaf: cheapest !== null && r.register_xaf ? Math.round(r.register_xaf * (1 - rules.paymentFeeRate - rules.fxCushionRate) - rules.supportCostXaf - cheapest) : null,
    };
  });
}
