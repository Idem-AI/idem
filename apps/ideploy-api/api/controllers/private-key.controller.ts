import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import * as service from '../services/private-key.service';

export async function list(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.listPrivateKeys(req.user!.currentTeamId!));
  } catch (err) {
    respondWithError(res, err, 'Listing private keys');
  }
}

export async function get(req: CustomRequest, res: Response): Promise<void> {
  try {
    const key = await service.getPrivateKeyView(req.user!.currentTeamId!, String(req.params.uuid));
    if (!key) return fail(res, 'Private key not found', 404, 'NOT_FOUND');
    ok(res, key);
  } catch (err) {
    respondWithError(res, err, 'Fetching the private key');
  }
}

/** Body validated by `createPrivateKeySchema` on the route. */
export async function create(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.createPrivateKey(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    respondWithError(res, err, 'Saving the private key');
  }
}

/**
 * Generate a key pair server-side. The response carries the public key — the
 * only time it is handed back with the freshly created record.
 */
export async function generate(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.generatePrivateKey(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    respondWithError(res, err, 'Generating the key pair');
  }
}

/** The `authorized_keys` line to install on a server. */
export async function publicKey(req: CustomRequest, res: Response): Promise<void> {
  try {
    const key = await service.getPublicKeyFor(req.user!.currentTeamId!, String(req.params.uuid));
    ok(res, { public_key: key });
  } catch (err) {
    respondWithError(res, err, 'Deriving the public key');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await service.deletePrivateKey(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Private key not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    respondWithError(res, err, 'Deleting the private key');
  }
}
