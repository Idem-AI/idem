/**
 * Multi-channel notification settings (one row per team per channel) + test
 * send. Ports Coolify's *NotificationSettings models. Secret columns are
 * Laravel-`encrypted`.
 */
import axios from 'axios';
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';

interface ChannelField {
  col: string;
  encrypted?: boolean;
  secret?: boolean; // masked in responses
}

interface ChannelDef {
  table: string;
  enabledCol: string;
  fields: ChannelField[];
}

export const CHANNELS: Record<string, ChannelDef> = {
  slack: {
    table: 'slack_notification_settings',
    enabledCol: 'slack_enabled',
    fields: [{ col: 'slack_webhook_url', encrypted: true, secret: true }],
  },
  discord: {
    table: 'discord_notification_settings',
    enabledCol: 'discord_enabled',
    fields: [{ col: 'discord_webhook_url', encrypted: true, secret: true }],
  },
  telegram: {
    table: 'telegram_notification_settings',
    enabledCol: 'telegram_enabled',
    fields: [
      { col: 'telegram_token', encrypted: true, secret: true },
      { col: 'telegram_chat_id', encrypted: true },
    ],
  },
  pushover: {
    table: 'pushover_notification_settings',
    enabledCol: 'pushover_enabled',
    fields: [
      { col: 'pushover_user_key', encrypted: true, secret: true },
      { col: 'pushover_api_token', encrypted: true, secret: true },
    ],
  },
};

export function getChannel(channel: string): ChannelDef | null {
  return CHANNELS[channel] ?? null;
}

async function getRow(def: ChannelDef, teamId: number): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(`SELECT * FROM ${def.table} WHERE team_id = $1 LIMIT 1`, [teamId]);
  return rows[0] ?? null;
}

/** Settings view (secrets masked). */
export async function getSettings(channel: string, teamId: number): Promise<Record<string, unknown>> {
  const def = getChannel(channel);
  if (!def) throw new Error(`Unknown channel: ${channel}`);
  const row = await getRow(def, teamId);
  const out: Record<string, unknown> = { enabled: row ? Boolean(row[def.enabledCol]) : false };
  for (const f of def.fields) {
    const decrypted = f.encrypted ? tryDecryptString((row?.[f.col] as string) ?? null) : (row?.[f.col] ?? null);
    out[f.col] = f.secret ? (decrypted ? '••••••' : null) : decrypted;
  }
  return out;
}

/** Decrypted secrets for internal use (test send / dispatch). */
async function getDecrypted(def: ChannelDef, teamId: number): Promise<Record<string, string>> {
  const row = await getRow(def, teamId);
  const out: Record<string, string> = {};
  for (const f of def.fields) {
    const v = f.encrypted ? tryDecryptString((row?.[f.col] as string) ?? null) : ((row?.[f.col] as string) ?? null);
    out[f.col] = v ?? '';
  }
  return out;
}

export async function updateSettings(
  channel: string,
  teamId: number,
  dto: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const def = getChannel(channel);
  if (!def) throw new Error(`Unknown channel: ${channel}`);

  const cols: string[] = ['team_id'];
  const vals: unknown[] = [teamId];
  if (dto.enabled !== undefined) {
    cols.push(def.enabledCol);
    vals.push(Boolean(dto.enabled));
  }
  for (const f of def.fields) {
    if (dto[f.col] !== undefined) {
      cols.push(f.col);
      vals.push(f.encrypted ? encryptString(String(dto[f.col])) : dto[f.col]);
    }
  }

  const existing = await getRow(def, teamId);
  if (existing) {
    const sets = cols.slice(1).map((c, i) => `${c} = $${i + 2}`);
    await pool.query(
      `UPDATE ${def.table} SET ${sets.join(', ')}, updated_at = now() WHERE team_id = $1`,
      vals
    );
  } else {
    const placeholders = vals.map((_, i) => `$${i + 1}`);
    await pool.query(
      `INSERT INTO ${def.table} (${cols.join(', ')}, created_at, updated_at) VALUES (${placeholders.join(', ')}, now(), now())`,
      vals
    );
  }
  return getSettings(channel, teamId);
}

/** Send a test notification through a channel. */
export async function testSend(channel: string, teamId: number, message = 'iDeploy test notification'): Promise<{ sent: boolean }> {
  const def = getChannel(channel);
  if (!def) throw new Error(`Unknown channel: ${channel}`);
  const creds = await getDecrypted(def, teamId);

  if (channel === 'slack' || channel === 'discord') {
    const url = channel === 'slack' ? creds.slack_webhook_url : creds.discord_webhook_url;
    if (!url) throw new Error('Webhook URL not configured');
    const body = channel === 'slack' ? { text: message } : { content: message };
    await axios.post(url, body, { timeout: 10000 });
  } else if (channel === 'telegram') {
    if (!creds.telegram_token || !creds.telegram_chat_id) throw new Error('Telegram not configured');
    await axios.get(`https://api.telegram.org/bot${creds.telegram_token}/sendMessage`, {
      params: { chat_id: creds.telegram_chat_id, text: message },
      timeout: 10000,
    });
  } else if (channel === 'pushover') {
    if (!creds.pushover_user_key || !creds.pushover_api_token) throw new Error('Pushover not configured');
    await axios.post(
      'https://api.pushover.net/1/messages.json',
      { token: creds.pushover_api_token, user: creds.pushover_user_key, message },
      { timeout: 10000 }
    );
  } else {
    throw new Error(`Test send not implemented for ${channel}`);
  }
  return { sent: true };
}
