import type { ReactNode } from 'react';
import { BatteryFull, Signal, Wifi } from 'lucide-react';

/**
 * Les deux téléphones de l'aperçu d'une application mobile.
 *
 * Dessinés en CSS, aux proportions des appareils les plus courants (iPhone 15,
 * Pixel 8). La barre d'état et la barre de navigation du système sont posées
 * AU-DESSUS et AU-DESSOUS de l'écran de l'application, jamais par-dessus :
 * l'application garde toute sa surface, comme sur un vrai téléphone où elle
 * commence sous l'heure et s'arrête au-dessus du geste de retour.
 */
export type PhoneDevice = 'ios' | 'android';

interface PhoneSpec {
  label: string;
  /** Écran de l'appareil, en points CSS. */
  width: number;
  height: number;
  statusBar: number;
  navBar: number;
  radius: number;
  bezel: number;
}

export const PHONES: Record<PhoneDevice, PhoneSpec> = {
  ios: { label: 'iPhone', width: 393, height: 852, statusBar: 54, navBar: 34, radius: 56, bezel: 12 },
  android: { label: 'Android', width: 412, height: 915, statusBar: 36, navBar: 28, radius: 38, bezel: 10 },
};

/** Hauteur totale dessinée (écran + cadre), pour ajuster le zoom à la place disponible. */
export function phoneOuterSize(device: PhoneDevice): { width: number; height: number } {
  const spec = PHONES[device];
  return { width: spec.width + spec.bezel * 2, height: spec.height + spec.bezel * 2 };
}

export function PhoneMockup({ device, children }: { device: PhoneDevice; children: ReactNode }) {
  const spec = PHONES[device];
  const ios = device === 'ios';

  return (
    <div
      className="relative shrink-0 bg-neutral-900 shadow-[var(--glass-shadow-xl)]"
      style={{
        width: spec.width + spec.bezel * 2,
        height: spec.height + spec.bezel * 2,
        padding: spec.bezel,
        borderRadius: spec.radius + spec.bezel,
      }}
    >
      {/* Boutons latéraux : volume à gauche (iPhone), marche à droite. */}
      {ios && (
        <>
          <span aria-hidden="true" className="absolute -left-[3px] top-[120px] h-8 w-[3px] rounded-l bg-neutral-800" />
          <span aria-hidden="true" className="absolute -left-[3px] top-[180px] h-14 w-[3px] rounded-l bg-neutral-800" />
          <span aria-hidden="true" className="absolute -left-[3px] top-[250px] h-14 w-[3px] rounded-l bg-neutral-800" />
          <span aria-hidden="true" className="absolute -right-[3px] top-[200px] h-20 w-[3px] rounded-r bg-neutral-800" />
        </>
      )}
      {!ios && (
        <>
          <span aria-hidden="true" className="absolute -right-[3px] top-[150px] h-12 w-[3px] rounded-r bg-neutral-800" />
          <span aria-hidden="true" className="absolute -right-[3px] top-[230px] h-24 w-[3px] rounded-r bg-neutral-800" />
        </>
      )}

      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-white"
        style={{ borderRadius: spec.radius }}
      >
        {/* Barre d'état du système */}
        <div
          aria-hidden="true"
          className="relative flex shrink-0 items-center justify-between bg-white text-neutral-900"
          style={{
            height: spec.statusBar,
            paddingInline: ios ? 32 : 20,
            paddingTop: ios ? 6 : 0,
          }}
        >
          <span className={ios ? 'text-[15px] font-semibold' : 'text-[13px] font-medium'}>9:41</span>
          {ios ? (
            // Dynamic Island
            <span className="absolute left-1/2 top-[11px] h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
          ) : (
            // Caméra en poinçon
            <span className="absolute left-1/2 top-[10px] h-[14px] w-[14px] -translate-x-1/2 rounded-full bg-black" />
          )}
          <span className="flex items-center gap-1">
            <Signal size={ios ? 15 : 13} strokeWidth={2.5} />
            <Wifi size={ios ? 15 : 13} strokeWidth={2.5} />
            <BatteryFull size={ios ? 22 : 16} strokeWidth={2} />
          </span>
        </div>

        {/* L'écran de l'application */}
        <div className="relative min-h-0 flex-1">{children}</div>

        {/* Barre de navigation du système */}
        <div aria-hidden="true" className="flex shrink-0 items-center justify-center bg-white" style={{ height: spec.navBar }}>
          <span className={ios ? 'h-[5px] w-[134px] rounded-full bg-black' : 'h-[4px] w-[108px] rounded-full bg-neutral-400'} />
        </div>
      </div>
    </div>
  );
}
