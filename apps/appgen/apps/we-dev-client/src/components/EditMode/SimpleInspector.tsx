import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ImagePlus,
  Italic,
  Minus,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import type { SelectedElementInfo } from './idemProtocol';

/**
 * LE PANNEAU D'UN ÉLÉMENT SÉLECTIONNÉ, pensé pour quelqu'un qui n'a jamais fait de site.
 *
 * Avant : sept rubriques ouvertes d'un coup (« Typographie », « Graisse », « Interligne », « Marge int. »,
 * « Ajustement : cover/contain »…), des valeurs en pixels et en noms CSS. Les éditeurs grand public et la recherche
 * disent la même chose :
 *
 *   - montrer d'abord l'essentiel, le reste à un clic (divulgation progressive, Nielsen Norman Group ; les débutants
 *     qui ne voient d'abord que le cœur apprennent mieux le reste ensuite — « training wheels », Carroll) ;
 *   - des mots de tous les jours (le jargon est la première gêne citée par les petites entreprises dans l'étude
 *     WordPress sur la création de sites) ;
 *   - des choix tout faits plutôt que des nombres (tailles S/M/L de Gutenberg, couleurs du thème) ;
 *   - des actions selon ce qui est sélectionné (barre contextuelle de Wix : texte, lien, image).
 *
 * D'où trois étages : « Que voulez-vous changer ? » (en ses mots, l'IA ne touche que cet élément), quelques actions
 * directes propres à l'élément, puis « Plus de réglages », replié, qui garde tous les réglages fins.
 */

export interface SitePageOption {
  path: string;
  title: string;
}

export interface SimpleInspectorProps {
  selected: SelectedElementInfo[];
  /** Les couleurs du site (design system), proposées en un clic. */
  colors: Array<{ value: string; label: string }>;
  pages: SitePageOption[];
  onClose: () => void;
  /** La demande écrite par la personne, envoyée à l'IA pour cet élément seulement. */
  onAsk?: (instruction: string) => void;
  onStyle: (cssProp: string, value: string) => void;
  onText: (text: string) => void;
  onAttr: (name: string, value: string | null) => void;
  onUpload: (file: File, asBackground: boolean) => void;
  onEnhance: () => void;
  enhancing: boolean;
  onDelete: () => void;
  /** Les réglages fins (anciennes rubriques), affichés sous « Plus de réglages ». */
  advanced: ReactNode;
}

const TEXT_KINDS = ['heading', 'text', 'link', 'button', 'input', 'list'];
const BOX_KINDS = ['container', 'generic', 'list'];

function rgbToHex(rgb: string | undefined): string {
  const m = rgb?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '';
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

const px = (value: string | undefined) => {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : undefined;
};

export function SimpleInspector(props: SimpleInspectorProps) {
  const { selected, onClose, onAsk, onDelete, advanced } = props;
  const { t } = useTranslation();
  const primary = selected[0];
  const multi = selected.length > 1;
  const [moreOpen, setMoreOpen] = useState(false);
  if (!primary) return null;

  const kind = primary.kind;
  const title = multi ? t('editMode.simple.many', { count: selected.length }) : t(`editMode.simple.kindTitle.${kind}`, { defaultValue: t('editMode.simple.kindTitle.generic') });
  const snippet = !multi && primary.text ? primary.text.replace(/\s+/g, ' ').trim().slice(0, 48) : '';

  return (
    <aside className="w-80 shrink-0 border-l border-[var(--glass-border)] bg-surface-2 flex flex-col overflow-hidden" aria-label={t('editMode.simple.panel')}>
      <header className="shrink-0 flex items-start gap-2 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {snippet && <p className="text-xs text-text-tertiary truncate">« {snippet} »</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
          aria-label={t('editMode.simple.close')}
          title={t('editMode.simple.close')}
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {onAsk && <AskBox key={selected.map((e) => e.id).join(',')} onAsk={onAsk} kind={multi ? 'many' : kind} />}

        <div className="px-4 py-3 space-y-5">
          {multi ? <ManyActions {...props} /> : <OneActions {...props} />}
        </div>

        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-danger transition-colors"
          >
            <Trash2 size={13} aria-hidden="true" />
            {multi ? t('editMode.simple.deleteMany', { count: selected.length }) : t('editMode.simple.delete', { what: t(`editMode.kind.${kind}`, { defaultValue: t('editMode.kind.generic') }) })}
          </button>
        </div>

        {/* Les réglages fins : repliés, pour qui en a besoin. */}
        <div className="border-t border-[var(--glass-border)]">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-text-secondary hover:bg-surface-3"
          >
            {t('editMode.simple.more')}
            <ChevronDown size={16} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {moreOpen && <div className="px-4 pb-4 space-y-4">{advanced}</div>}
        </div>
      </div>
    </aside>
  );
}

/* ---------- 1. En ses mots ---------- */

function AskBox({ onAsk, kind }: { onAsk: (instruction: string) => void; kind: string }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const id = useId();
  const send = () => {
    const text = value.trim();
    if (!text) return;
    onAsk(text);
    setValue('');
  };
  return (
    <div className="mx-4 mt-1 rounded-xl border border-[var(--glass-border)] bg-surface-1 p-3">
      <label htmlFor={id} className="!block text-sm font-medium text-text-primary !mb-0">
        {t('editMode.simple.askTitle')}
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={t(kind === 'image' ? 'editMode.simple.askPlaceholderImage' : BOX_KINDS.includes(kind) ? 'editMode.simple.askPlaceholderBox' : 'editMode.simple.askPlaceholder')}
        className="mt-2 w-full resize-none text-sm !min-h-[3.75rem]"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-text-tertiary">{t('editMode.simple.askHint')}</p>
        <Button variant="primary" onClick={send} disabled={!value.trim()} icon={<Send size={14} aria-hidden="true" />}>
          {t('editMode.simple.askSend')}
        </Button>
      </div>
    </div>
  );
}

/* ---------- 2. Les actions directes, selon l'élément ---------- */

function OneActions({ selected, colors, pages, onStyle, onText, onAttr, onUpload, onEnhance, enhancing }: SimpleInspectorProps) {
  const { t } = useTranslation();
  const info = selected[0];
  const kind = info.kind;
  const textLike = TEXT_KINDS.includes(kind);
  const href = info.attrs.href;
  const isButton = kind === 'button';

  return (
    <>
      {info.textEditable && kind !== 'image' && kind !== 'icon' && <TextField info={info} onText={onText} />}

      {kind === 'image' && <ImageActions info={info} onUpload={onUpload} onEnhance={onEnhance} enhancing={enhancing} />}

      {href !== undefined && <Destination info={info} pages={pages} onAttr={onAttr} />}

      {textLike && <TextLook info={info} onStyle={onStyle} />}

      {(isButton || BOX_KINDS.includes(kind)) && (
        <Field label={t(isButton ? 'editMode.simple.buttonColor' : 'editMode.simple.bgColor')}>
          <Swatches colors={colors} current={rgbToHex(info.computed.backgroundColor)} onPick={(value) => onStyle('backgroundColor', value)} />
        </Field>
      )}

      {(textLike || kind === 'icon') && (
        <Field label={t(kind === 'icon' ? 'editMode.simple.iconColor' : 'editMode.simple.textColor')}>
          <Swatches colors={colors} current={rgbToHex(info.computed.color)} onPick={(value) => onStyle('color', value)} />
        </Field>
      )}

      {BOX_KINDS.includes(kind) && <BoxActions info={info} onStyle={onStyle} onUpload={onUpload} />}
    </>
  );
}

function ManyActions({ selected, colors, onStyle }: SimpleInspectorProps) {
  const { t } = useTranslation();
  return (
    <>
      <TextLook info={selected[0]} onStyle={onStyle} />
      <Field label={t('editMode.simple.textColor')}>
        <Swatches colors={colors} current="" onPick={(value) => onStyle('color', value)} />
      </Field>
    </>
  );
}

function TextField({ info, onText }: { info: SelectedElementInfo; onText: (text: string) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="!block text-sm font-medium text-text-primary !mb-1.5">
        {t('editMode.simple.text')}
      </label>
      <textarea
        id={id}
        key={info.id}
        defaultValue={info.text}
        rows={Math.min(5, Math.max(2, Math.ceil(info.text.length / 34)))}
        className="w-full resize-y text-sm !min-h-[2.75rem]"
        onBlur={(event) => {
          if (event.target.value !== info.text) onText(event.target.value);
        }}
      />
      <p className="mt-1 text-[11px] text-text-tertiary">{t('editMode.simple.textHint')}</p>
    </div>
  );
}

/** Taille (plus petit / plus grand), gras, italique, alignement : sans un seul nombre. */
function TextLook({ info, onStyle }: { info: SelectedElementInfo; onStyle: (p: string, v: string) => void }) {
  const { t } = useTranslation();
  const size = px(info.computed.fontSize) ?? 16;
  const bold = Number(info.computed.fontWeight) >= 600;
  const italic = info.computed.fontStyle === 'italic';
  const align = info.computed.textAlign;
  const step = (factor: number) => onStyle('fontSize', `${Math.max(10, Math.min(120, Math.round(size * factor)))}px`);
  return (
    <>
      <Field label={t('editMode.simple.size')}>
        <div className="flex gap-2">
          <Choice onClick={() => step(1 / 1.15)} label={t('editMode.simple.smaller')} icon={<Minus size={14} aria-hidden="true" />} />
          <Choice onClick={() => step(1.15)} label={t('editMode.simple.bigger')} icon={<Plus size={14} aria-hidden="true" />} />
        </div>
      </Field>
      <Field label={t('editMode.simple.look')}>
        <div className="flex gap-2">
          <Choice pressed={bold} onClick={() => onStyle('fontWeight', bold ? '400' : '700')} label={t('editMode.simple.bold')} icon={<Bold size={14} aria-hidden="true" />} />
          <Choice pressed={italic} onClick={() => onStyle('fontStyle', italic ? 'normal' : 'italic')} label={t('editMode.simple.italic')} icon={<Italic size={14} aria-hidden="true" />} />
        </div>
      </Field>
      <Field label={t('editMode.simple.align')}>
        <div className="flex gap-2" role="group" aria-label={t('editMode.simple.align')}>
          {(
            [
              ['left', AlignLeft, 'editMode.simple.alignLeft'],
              ['center', AlignCenter, 'editMode.simple.alignCenter'],
              ['right', AlignRight, 'editMode.simple.alignRight'],
            ] as const
          ).map(([value, Icon, key]) => (
            <Choice key={value} pressed={align === value || (value === 'left' && align === 'start')} onClick={() => onStyle('textAlign', value)} label={t(key)} icon={<Icon size={14} aria-hidden="true" />} iconOnly />
          ))}
        </div>
      </Field>
    </>
  );
}

/** Où mène un bouton ou un lien : une page du site choisie dans une liste, sinon une adresse web. */
function Destination({ info, pages, onAttr }: { info: SelectedElementInfo; pages: SitePageOption[]; onAttr: (n: string, v: string | null) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const href = info.attrs.href ?? '';
  const norm = (path: string) => (path || '/').split('#')[0].replace(/\/?$/, '/');
  const known = pages.find((page) => norm(page.path) === norm(href) && !href.includes('#'));
  const [custom, setCustom] = useState(!known && !!href);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (custom) inputRef.current?.focus();
  }, [custom]);
  return (
    <div>
      <label htmlFor={id} className="!block text-sm font-medium text-text-primary !mb-1.5">
        {t(info.kind === 'button' ? 'editMode.simple.buttonLeadsTo' : 'editMode.simple.linkLeadsTo')}
      </label>
      {pages.length > 0 && (
        <select
          id={id}
          key={`${info.id}-${href}`}
          defaultValue={known ? known.path : '__custom'}
          className="w-full text-sm"
          onChange={(event) => {
            if (event.target.value === '__custom') return setCustom(true);
            setCustom(false);
            onAttr('href', event.target.value);
          }}
        >
          {pages.map((page) => (
            <option key={page.path} value={page.path}>
              {page.title || page.path}
            </option>
          ))}
          <option value="__custom">{t('editMode.simple.otherAddress')}</option>
        </select>
      )}
      {(custom || !pages.length) && (
        <input
          ref={inputRef}
          id={pages.length ? undefined : id}
          key={`${info.id}-input`}
          type="text"
          defaultValue={known ? '' : href}
          placeholder={t('editMode.simple.addressPlaceholder')}
          className="mt-2 w-full text-sm"
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== href) onAttr('href', value);
          }}
        />
      )}
    </div>
  );
}

function ImageActions({ info, onUpload, onEnhance, enhancing }: { info: SelectedElementInfo; onUpload: (f: File, bg: boolean) => void; onEnhance: () => void; enhancing: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {info.src && (
        <div className="rounded-lg border border-[var(--glass-border)] overflow-hidden bg-surface-1">
          <img src={info.src} alt="" className="max-h-36 w-full object-contain" />
        </div>
      )}
      <UploadButton label={t('editMode.simple.replaceImage')} onFile={(file) => onUpload(file, false)} primary />
      {info.src && !info.src.startsWith('data:') && (
        <Button variant="secondary" onClick={onEnhance} loading={enhancing} disabled={enhancing} icon={<Sparkles size={14} aria-hidden="true" />} className="w-full">
          {t(enhancing ? 'editMode.enhancing' : 'editMode.simple.sharpen')}
        </Button>
      )}
    </div>
  );
}

/** Un bloc : son image de fond, et l'espace autour de son contenu en trois choix. */
function BoxActions({ info, onStyle, onUpload }: { info: SelectedElementInfo; onStyle: (p: string, v: string) => void; onUpload: (f: File, bg: boolean) => void }) {
  const { t } = useTranslation();
  const padding = px(info.computed.paddingTop) ?? 0;
  const presets = [
    ['16px', 'editMode.simple.spaceTight', 16],
    ['32px', 'editMode.simple.spaceNormal', 32],
    ['64px', 'editMode.simple.spaceRoomy', 64],
  ] as const;
  const nearest = presets.reduce((best, p) => (Math.abs(p[2] - padding) < Math.abs(best[2] - padding) ? p : best), presets[1]);
  return (
    <>
      <Field label={t('editMode.simple.bgImage')}>
        <div className="flex gap-2">
          <UploadButton label={t(info.hasBackgroundImage ? 'editMode.simple.changeBgImage' : 'editMode.simple.addBgImage')} onFile={(file) => onUpload(file, true)} />
          {info.hasBackgroundImage && (
            <Button variant="ghost" onClick={() => onStyle('backgroundImage', 'none')}>
              {t('editMode.simple.removeBgImage')}
            </Button>
          )}
        </div>
      </Field>
      <Field label={t('editMode.simple.space')}>
        <div className="flex gap-2">
          {presets.map(([value, key]) => (
            <Choice key={value} pressed={nearest[0] === value && padding > 0} onClick={() => onStyle('padding', value)} label={t(key)} />
          ))}
        </div>
      </Field>
    </>
  );
}

/* ---------- briques ---------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-text-primary mb-1.5">{label}</p>
      {children}
    </div>
  );
}

/** Un choix en un clic : un bouton à bascule, avec son mot (l'icône seule n'est jamais la seule information). */
function Choice({ label, icon, pressed, onClick, iconOnly }: { label: string; icon?: ReactNode; pressed?: boolean; onClick: () => void; iconOnly?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={`h-9 ${iconOnly ? 'w-10' : 'flex-1 px-2'} inline-flex items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors ${
        pressed ? 'border-primary bg-primary/10 text-text-primary' : 'border-[var(--glass-border)] text-text-secondary hover:bg-surface-3 hover:text-text-primary'
      }`}
    >
      {icon}
      {!iconOnly && <span className="truncate">{label}</span>}
    </button>
  );
}

/** Les couleurs du site en pastilles, et « Autre couleur » pour qui veut la sienne. */
function Swatches({ colors, current, onPick }: { colors: Array<{ value: string; label: string }>; current: string; onPick: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map((color) => {
        const active = current.toLowerCase() === color.value.toLowerCase();
        return (
          <button
            key={color.value}
            type="button"
            onClick={() => onPick(color.value)}
            aria-pressed={active}
            aria-label={color.label}
            title={color.label}
            className={`h-8 w-8 rounded-full border transition-shadow ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--surface-2,transparent)]' : 'hover:ring-2 hover:ring-[var(--glass-border)]'} border-[var(--glass-border)]`}
            style={{ backgroundColor: color.value }}
          />
        );
      })}
      <label className="relative h-8 px-2.5 !inline-flex !flex-row items-center gap-1 !mb-0 whitespace-nowrap rounded-full border border-dashed border-[var(--glass-border)] text-xs text-text-secondary cursor-pointer hover:text-text-primary">
        <Plus size={12} aria-hidden="true" />
        {t('editMode.simple.otherColor')}
        <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" defaultValue={current || '#000000'} onChange={(event) => onPick(event.target.value)} aria-label={t('editMode.simple.otherColor')} />
      </label>
    </div>
  );
}

function UploadButton({ label, onFile, primary }: { label: string; onFile: (file: File) => void; primary?: boolean }) {
  return (
    <label className={`${primary ? 'inner-button !w-full' : 'outer-button'} button-sm !inline-flex !flex-row items-center justify-center gap-2 !mb-0 whitespace-nowrap cursor-pointer`}>
      <ImagePlus size={14} aria-hidden="true" />
      {label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}
