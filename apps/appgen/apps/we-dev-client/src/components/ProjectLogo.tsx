import { useState } from 'react';
import type { LogoModel } from '@/api/persistence/models/logo.model';
import { resolveProjectLogoIconSrc } from '@/utils/logoSrc';

interface ProjectLogoProps {
  logo?: LogoModel | null;
  /** Project name — used for the accessible label and the fallback initial. */
  name?: string;
  /** Rendered square size in px. */
  size?: number;
  className?: string;
}

/**
 * Project logo chip.
 *
 * The chip background stays light in both themes: the rendition we serve is the
 * light-background one, so a dark chip would make it unreadable. Falls back to
 * the project initial when no logo exists or when its URL fails to load (asset
 * removed from the bucket, legacy project).
 */
export function ProjectLogo({ logo, name, size = 32, className = '' }: ProjectLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const src = resolveProjectLogoIconSrc(logo);
  const showImage = !!src && src !== failedSrc;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/10 ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ? `Logo ${name}` : 'Project logo'}
          className="h-full w-full object-contain p-1"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-semibold leading-none text-primary"
          style={{ fontSize: Math.round(size * 0.45) }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}

export default ProjectLogo;
