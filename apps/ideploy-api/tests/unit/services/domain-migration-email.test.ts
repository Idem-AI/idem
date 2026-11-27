/**
 * The migration report must reach beta@idem.africa even when the IDEM API is
 * restarting at the same time as iDeploy (both deployed by the same push).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn();
vi.mock('../../../api/services/email.service', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { reportEmail, sendWithRetry } from '../../../api/services/domain-migration.service';

describe('sendWithRetry', () => {
  beforeEach(() => sendEmail.mockReset());

  it('tries again until the IDEM API accepts the email', async () => {
    sendEmail.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await sendWithRetry(reportEmail({ state: 'nothing_to_do', entries: [] }), [1, 1, 1])).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(sendEmail.mock.calls[0][0].to).toBe('beta@idem.africa');
  });

  it('gives up after the last wait', async () => {
    sendEmail.mockResolvedValue(false);
    expect(await sendWithRetry(reportEmail({ state: 'nothing_to_do', entries: [] }), [1, 1])).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(3);
  });
});
