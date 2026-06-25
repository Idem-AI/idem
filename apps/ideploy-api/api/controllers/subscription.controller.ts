import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import * as sub from '../services/subscription.service';
import * as team from '../services/team.service';

const teamId = (req: CustomRequest) => req.user!.currentTeamId!;

export async function plans(_req: CustomRequest, res: Response): Promise<void> {
  ok(res, await sub.listPlans());
}

export async function current(req: CustomRequest, res: Response): Promise<void> {
  ok(res, await sub.getSubscription(teamId(req)));
}

export async function quota(req: CustomRequest, res: Response): Promise<void> {
  ok(res, await sub.getQuota(teamId(req)));
}

export async function checkout(req: CustomRequest, res: Response): Promise<void> {
  const { price_id, success_url, cancel_url } = req.body ?? {};
  if (!price_id) return fail(res, 'price_id is required', 422, 'VALIDATION');
  try {
    ok(
      res,
      await sub.createCheckout(
        teamId(req),
        String(price_id),
        String(success_url ?? 'http://localhost:4202/subscription?success=1'),
        String(cancel_url ?? 'http://localhost:4202/subscription?canceled=1')
      )
    );
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create checkout');
  }
}

export async function portal(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await sub.createPortal(teamId(req), String(req.body?.return_url ?? 'http://localhost:4202/subscription')));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create portal session');
  }
}

export async function cancel(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await sub.cancelSubscription(teamId(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to cancel subscription');
  }
}

/** Admin override: change a team's plan directly. */
export async function changePlan(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.plan) return fail(res, 'plan is required', 422, 'VALIDATION');
  try {
    await team.requireAdmin(req.user!.id, teamId(req));
    ok(
      res,
      await sub.changePlan(teamId(req), String(req.body.plan), {
        appLimit: req.body.app_limit,
        serverLimit: req.body.server_limit,
      })
    );
  } catch (err) {
    fail(res, (err as Error).message, 403);
  }
}
