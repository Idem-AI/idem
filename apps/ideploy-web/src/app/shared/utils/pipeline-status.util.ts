import { PipelineStatus } from '../models/ideploy.models';

/**
 * Status → colour/icon, shared by the run list's small per-stage dots and the
 * detail page's big pipeline graph so a colour never means something
 * different depending on which screen it is read from.
 */
export function pipelineStatusColor(status: string): string {
  if (status === 'success') return 'var(--color-success)';
  if (status === 'failed') return 'var(--color-danger)';
  if (status === 'running') return 'var(--color-warning)';
  if (status === 'skipped') return 'var(--color-text-tertiary)';
  return 'var(--color-text-secondary)';
}

export function pipelineStatusBackground(status: string): string {
  return `color-mix(in srgb, ${pipelineStatusColor(status)} 16%, transparent)`;
}

/** FontAwesome class for a status badge (sized for normal text). */
export function pipelineStatusIcon(status: string): string {
  if (status === 'success') return 'fa-solid fa-circle-check';
  if (status === 'failed') return 'fa-solid fa-circle-xmark';
  if (status === 'running') return 'fa-solid fa-spinner fa-spin';
  if (status === 'skipped') return 'fa-solid fa-forward';
  return 'fa-solid fa-clock';
}

/** Same glyphs as `pipelineStatusIcon`, sized for a small dot instead of a badge. */
export function pipelineStageMarkIcon(status: string): string {
  if (status === 'success') return 'fa-solid fa-check text-[9px]';
  if (status === 'failed') return 'fa-solid fa-xmark text-[9px]';
  if (status === 'running') return 'fa-solid fa-spinner fa-spin text-[8px]';
  if (status === 'skipped') return 'fa-solid fa-forward text-[8px]';
  return '';
}

export function isPipelineActive(status: string): boolean {
  return status === 'pending' || status === 'running';
}

/** `1m23s` / `47s` — pipeline stage durations are short enough that a coarser unit is never useful. */
export function formatPipelineDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

export type { PipelineStatus };
