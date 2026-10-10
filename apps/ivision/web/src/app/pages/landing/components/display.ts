import { Directive, computed, input } from '@angular/core';

/**
 * Les titres monumentaux de la landing, en Vilevile Black. Une seule échelle pour toute la page,
 * fluide entre le téléphone et le très grand écran (plafonnée) :
 *   hero      les deux mots d'ouverture (« Dites-le. » / « Voyez-le. »)
 *   section   le titre de chaque section
 *   word      un mot seul qui occupe la moitié de l'écran (les deux ateliers)
 * Pas d'approche (`tracking-*`) : elle est dans la police.
 */
@Directive({
  selector: '[ivDisplay]',
  host: { '[class]': 'classes()' },
})
export class Display {
  readonly ivDisplay = input<'hero' | 'section' | 'word' | ''>('section');

  protected readonly classes = computed(() => {
    switch (this.ivDisplay()) {
      case 'hero':
        return 'block font-black leading-[0.9] text-[clamp(3rem,15vw,5rem)] lg:text-[clamp(3.75rem,6.4vw,7rem)] 3xl:text-[clamp(7rem,5.2vw,9rem)]';
      case 'word':
        return 'block font-black leading-[0.9] text-[clamp(3rem,15vw,5rem)] md:text-[clamp(3.75rem,6.6vw,7rem)] 3xl:text-[clamp(7rem,5vw,8.5rem)]';
      default:
        return 'block font-black leading-[0.95] text-balance text-[clamp(2.25rem,9.5vw,3.5rem)] md:text-[clamp(3rem,5.2vw,5.5rem)] 3xl:text-[clamp(5.5rem,4.2vw,7rem)]';
    }
  });
}
