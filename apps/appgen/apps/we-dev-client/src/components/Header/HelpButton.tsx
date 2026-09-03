import { useState } from 'react';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  HelpCircle,
  MessageSquare,
  Compass,
  MousePointerClick,
  Palette,
  Rocket,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { HelpIllustration } from '@/components/ui/Illustrations';
import { restartTour } from '@/hooks/useTour';

/**
 * Aide.
 *
 * L'ancien contenu était un assistant en cinq étapes, en anglais, recoloré aux
 * couleurs de la charte du projet généré — donc illisible selon les projets — et
 * qui ne s'ouvrait pas du tout hors d'un projet Idem : le bouton « ? » ne
 * faisait alors rien.
 *
 * Ce panneau décrit le produit tel qu'il est, dans la langue de l'interface, et
 * s'ouvre toujours.
 */
export function HelpButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const sections = [
    { key: 'chat', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'modes', icon: <Compass className="w-4 h-4" /> },
    { key: 'toolbar', icon: <MousePointerClick className="w-4 h-4" /> },
    { key: 'theme', icon: <Palette className="w-4 h-4" /> },
    { key: 'publish', icon: <Rocket className="w-4 h-4" /> },
  ] as const;

  return (
    <>
      <Button
        variant="icon"
        onClick={() => setOpen(true)}
        title={t('help.title')}
        aria-label={t('help.title')}
        icon={<HelpCircle className="w-4 h-4" />}
      />

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={620}
        centered
        destroyOnClose
        styles={{
          content: {
            backgroundColor: 'var(--idem-surface-1)',
            padding: 0,
            borderRadius: 16,
            border: '1px solid var(--glass-border)',
          },
          body: { padding: 0 },
          header: { display: 'none' },
        }}
      >
        <div className="p-6">
          <div className="flex items-start gap-5 mb-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-text-primary">{t('help.title')}</h3>
              <p className="mt-1 text-sm text-text-secondary text-pretty">{t('help.subtitle')}</p>
            </div>
            <HelpIllustration size={72} className="hidden sm:block shrink-0" />
          </div>

          <dl className="space-y-3.5">
            {sections.map(({ key, icon }) => (
              <div key={key} className="flex gap-3">
                <span className="shrink-0 w-8 h-8 grid place-items-center rounded-lg bg-primary/12 text-primary">
                  {icon}
                </span>
                <div className="min-w-0">
                  <dt className="text-sm font-medium text-text-primary">
                    {t(`help.sections.${key}.title`)}
                  </dt>
                  <dd className="mt-0.5 text-[13px] text-text-secondary leading-relaxed text-pretty">
                    {t(`help.sections.${key}.body`)}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-6 pt-4 border-t border-[var(--glass-border)] flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                restartTour();
              }}
            >
              {t('help.tour')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              {t('help.gotIt')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default HelpButton;
