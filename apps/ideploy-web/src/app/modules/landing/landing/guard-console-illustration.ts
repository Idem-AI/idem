import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * L'écran de sécurité d'une application en ligne, redessiné au trait comme
 * une capture d'écran (AGENTS.md § 4) : à gauche, le bouclier aux lances
 * croisées arrête les requêtes qui arrivent ; à droite, ce que la console
 * relève (requêtes, blocages, ressources, dernière analyse).
 *
 * Deux encres : `currentColor` pour le trait, l'accent de la marque pour le
 * seul détail qui compte, le cœur du bouclier. La fenêtre est remplie à la
 * couleur de la surface, comme `live-shop-illustration`, sa voisine.
 */
@Component({
  selector: 'app-guard-console-illustration',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 480 368"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="img"
      [attr.aria-label]="
        ('landing.guard.console.app' | translate) +
        ' — ' +
        ('landing.guard.console.state' | translate) +
        ' — 2 471 ' +
        ('landing.guard.console.blocked' | translate)
      "
      class="w-full h-auto"
      style="color: var(--color-text-secondary);">
      <!-- La fenêtre et le nom de l'application -->
      <rect x="8" y="8" width="464" height="334" rx="14" stroke-width="2" style="fill: var(--color-surface-1);" />
      <path d="M8 44 H472" />
      <circle cx="30" cy="26" r="4" opacity=".6" />
      <circle cx="44" cy="26" r="4" opacity=".6" />
      <circle cx="58" cy="26" r="4" opacity=".6" />
      <rect x="96" y="15" width="288" height="22" rx="11" opacity=".8" />
      <text x="112" y="30.5" font-size="11.5" font-weight="600" stroke="none" fill="currentColor" style="font-family: inherit;">
        {{ 'landing.guard.console.app' | translate }}
      </text>

      <!-- Le bouclier arrête ce qui arrive -->
      <rect x="24" y="60" width="248" height="266" rx="10" />
      <path d="M36 150 H122 M36 193 H118 M36 236 H122" stroke-dasharray="6 6" opacity=".7" />
      <path d="M116 145 L122 150 L116 155 M112 188 L118 193 L112 198 M116 231 L122 236 L116 241" stroke-width="1.6" />
      <path d="M128 140 L133 135 M128 160 L133 165 M124 183 L129 178 M124 203 L129 208 M128 226 L133 221 M128 246 L133 251" opacity=".75" />
      <g transform="translate(12 0)">
        <path d="M92 98 L204 288 M204 98 L92 288" stroke-width="2" />
        <path d="M92 98 L96.3 95.5 L84.9 85.9 L87.7 100.5 Z M204 98 L208.3 100.5 L211.1 85.9 L199.7 95.5 Z" stroke-width="1.6" />
        <path d="M200 291 L208 285 M88 285 L96 291" />
        <path d="M148 118 C182 140 182 246 148 268 C114 246 114 140 148 118 Z" stroke-width="2" style="fill: var(--color-surface-1);" />
        <path d="M148 130 C174 150 174 236 148 256 C122 236 122 150 148 130 Z" opacity=".55" />
        <path d="M130 160 L136 155 L142 160 L148 155 L154 160 L160 155 L166 160 M130 226 L136 231 L142 226 L148 231 L154 226 L160 231 L166 226" stroke-width="1.1" opacity=".75" />
        <g style="color: var(--color-primary-500);">
          <path d="M148 178 L163 193 L148 208 L133 193 Z" stroke-width="2" />
          <path d="M148 189 L152 193 L148 197 L144 193 Z" stroke-width="1.4" />
        </g>
      </g>

      <!-- Ce que la console relève -->
      <rect x="284" y="60" width="172" height="60" rx="10" />
      <text x="298" y="92" font-size="22" font-weight="800" stroke="none" fill="currentColor" style="font-family: inherit;">184 302</text>
      <text x="298" y="110" font-size="10.5" stroke="none" fill="currentColor" opacity=".7" style="font-family: inherit;">
        {{ 'landing.guard.console.requests' | translate }}
      </text>
      <rect x="284" y="130" width="172" height="60" rx="10" />
      <text x="298" y="162" font-size="22" font-weight="800" stroke="none" fill="currentColor" style="font-family: inherit;">2 471</text>
      <text x="298" y="180" font-size="10.5" stroke="none" fill="currentColor" opacity=".7" style="font-family: inherit;">
        {{ 'landing.guard.console.blocked' | translate }}
      </text>

      @for (m of meters; track m.key; let i = $index) {
        <text [attr.x]="284" [attr.y]="212 + i * 24" font-size="10" stroke="none" fill="currentColor" opacity=".7" style="font-family: inherit;">
          {{ 'landing.guard.console.' + m.key | translate }}
        </text>
        <text [attr.x]="456" [attr.y]="212 + i * 24" font-size="10" text-anchor="end" stroke="none" fill="currentColor" style="font-family: inherit;">
          {{ m.reading }}
        </text>
        <path [attr.d]="'M284 ' + (220 + i * 24) + ' H456'" stroke-width="4" opacity=".2" />
        <path [attr.d]="'M284 ' + (220 + i * 24) + ' H' + (284 + 1.72 * m.percent)" stroke-width="4" />
      }

      @for (scan of scans; track scan.key; let i = $index) {
        <path [attr.d]="'M286 ' + (290 + i * 22) + ' L290 ' + (294 + i * 22) + ' L297 ' + (286 + i * 22)" stroke-width="1.8" />
        <text [attr.x]="304" [attr.y]="294 + i * 22" font-size="10.5" font-weight="600" stroke="none" fill="currentColor" style="font-family: inherit;">
          {{ 'landing.guard.console.' + scan.key | translate }}
        </text>
        <text [attr.x]="456" [attr.y]="294 + i * 22" font-size="10.5" text-anchor="end" stroke="none" fill="currentColor" opacity=".7" style="font-family: inherit;">
          {{ 'landing.guard.console.' + scan.result | translate }}
        </text>
      }

      <!-- L'état, posé sur le bord de la fenêtre -->
      <rect x="336" y="324" width="128" height="34" rx="17" stroke-width="2" style="fill: var(--color-surface-1);" />
      <circle cx="356" cy="341" r="4" stroke="none" fill="currentColor" />
      <text x="368" y="345.5" font-size="12.5" font-weight="700" stroke="none" fill="currentColor" style="font-family: inherit;">
        {{ 'landing.guard.console.state' | translate }}
      </text>
    </svg>
  `,
})
export class GuardConsoleIllustrationComponent {
  protected readonly meters = [
    { key: 'cpu', reading: '4 %', percent: 4 },
    { key: 'memory', reading: '212 / 512 Mo', percent: 41 },
    { key: 'disk', reading: '18 / 40 Go', percent: 45 },
  ];

  protected readonly scans = [
    { key: 'sonar', result: 'sonarResult' },
    { key: 'trivy', result: 'trivyResult' },
  ];
}
