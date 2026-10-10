import { Directive } from '@angular/core';

/**
 * La largeur de contenu de la landing, au même endroit pour toutes les sections : 1280 px sur un
 * écran courant, puis plus large sur les très grands écrans (1536 px et plus), pour que la page
 * ne flotte pas au milieu d'un 27 pouces. Les marges latérales grandissent avec l'écran.
 */
@Directive({
  selector: '[ivWrap]',
  host: { class: 'mx-auto w-full max-w-7xl px-5 sm:px-8 2xl:max-w-[88rem] 3xl:max-w-[104rem] 3xl:px-12' },
})
export class Wrap {}
