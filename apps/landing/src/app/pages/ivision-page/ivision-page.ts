import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

/** Un atelier d'iVision : une conversation, un type de livrable. */
interface Workshop {
  title: string;
  description: string;
  detail: string;
}

interface Step {
  title: string;
  description: string;
}

interface Capability {
  title: string;
  description: string;
}

interface EcosystemLink {
  name: string;
  description: string;
  href: string;
}

/**
 * La page de présentation d'iVision sur la landing.
 *
 * Le contenu vient de l'application elle-même (`apps/ivision/web`, ses textes
 * d'accueil) : les deux ateliers, la charte lue depuis un site, la
 * reproduction d'un modèle, la retouche en cliquant, le montage d'une prise de
 * parole. Rien n'est inventé ici — une page produit qui promet autre chose que
 * le produit est un défaut, pas une accroche.
 *
 * Le cran de créativité est décrit **sans prix** : l'accueil d'iVision annonce
 * encore des multiplicateurs (×1,25, ×2) que le modèle économique actuel ne
 * pratique plus. Mieux vaut n'en rien dire que répéter un chiffre faux.
 */
@Component({
  selector: 'app-ivision-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageArtComponent],
  templateUrl: './ivision-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './ivision-page.css'],
})
export class IvisionPage {
  protected readonly ivisionUrl = environment.services.ivision.url;
  protected readonly idevUrl = environment.services.idev.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  /** Les deux conversations, jamais mélangées. */
  protected readonly workshops: Workshop[] = [
    {
      title: $localize`:@@ivision-page.workshop.video.title:Videos`,
      description: $localize`:@@ivision-page.workshop.video.description:Motion design from 6 to 60 seconds, with royalty-free music and sound effects. Or your own piece to camera, edited for you.`,
      detail: $localize`:@@ivision-page.workshop.video.detail:6 to 60 seconds · every network format`,
    },
    {
      title: $localize`:@@ivision-page.workshop.image.title:Visuals`,
      description: $localize`:@@ivision-page.workshop.image.description:Posters, posts, stories, banners — composed to the millimetre and checked by eye before they are handed to you.`,
      detail: $localize`:@@ivision-page.workshop.image.detail:poster · post · story · banner`,
    },
  ];

  protected readonly steps: Step[] = [
    {
      title: $localize`:@@ivision-page.step.say.title:Say what you want to announce`,
      description: $localize`:@@ivision-page.step.say.description:« A video for our end-of-year sale: 30 % off the whole shop, until 31 December. » One sentence is enough — written, or dictated.`,
    },
    {
      title: $localize`:@@ivision-page.step.brand.title:It takes your colours`,
      description: $localize`:@@ivision-page.step.brand.description:Paste your website’s address and iVision reads its colours, fonts, logo and tone. No site? « In blue and gold » in your request does the job.`,
    },
    {
      title: $localize`:@@ivision-page.step.watch.title:Watch it get made`,
      description: $localize`:@@ivision-page.step.watch.description:Shots appear one after another, with their text, their images and their music. You see the film before it is finished.`,
    },
    {
      title: $localize`:@@ivision-page.step.edit.title:Click, write, it is changed`,
      description: $localize`:@@ivision-page.step.edit.description:Click any text: the video jumps to the moment it appears and changes while you type. Do not like a photo? Replace it in one click.`,
    },
    {
      title: $localize`:@@ivision-page.step.publish.title:Publish, or download`,
      description: $localize`:@@ivision-page.step.publish.description:Every network format at once, or the file on your machine. Nothing is published until you have approved it.`,
    },
  ];

  protected readonly capabilities: Capability[] = [
    {
      title: $localize`:@@ivision-page.capability.stencil.title:Show it a model, it copies it`,
      description: $localize`:@@ivision-page.capability.stencil.description:A video or a poster you like? Add it. iVision takes its cutting, its movements and its composition — with your texts, your images and your music.`,
    },
    {
      title: $localize`:@@ivision-page.capability.montage.title:Film yourself, it edits`,
      description: $localize`:@@ivision-page.capability.montage.description:Import a video of you talking. iVision cuts the silences and the hesitations, adds the subtitles, and makes what you say appear on screen.`,
    },
    {
      title: $localize`:@@ivision-page.capability.voice.title:Speak instead of typing`,
      description: $localize`:@@ivision-page.capability.voice.description:Dictate your request. It is transcribed on our own machines — the recording never leaves for a third party, and it is deleted as soon as the text exists.`,
    },
    {
      title: $localize`:@@ivision-page.capability.formats.title:Every format, one request`,
      description: $localize`:@@ivision-page.capability.formats.description:The same film laid out for a feed, a story and a screen. You do not reframe anything by hand.`,
    },
    {
      title: $localize`:@@ivision-page.capability.creativity.title:A gauge for how far it goes`,
      description: $localize`:@@ivision-page.capability.creativity.description:Four notches, from a plain composition to a real piece of authored work. The notch picks the range of templates it draws from.`,
    },
    {
      title: $localize`:@@ivision-page.capability.photos.title:Your photos stay your photos`,
      description: $localize`:@@ivision-page.capability.photos.description:No filter, no duotone, no tracing. What you upload is what is shown — a check in the code makes sure of it.`,
    },
  ];

  protected readonly ecosystem: EcosystemLink[] = [
    {
      name: $localize`:@@ivision-page.ecosystem.idem.name:The IDEM platform`,
      description: $localize`:@@ivision-page.ecosystem.idem.description:Brand charter, business plan, communication calendar. A charter made in IDEM is imported into iVision in one click.`,
      href: this.dashboardUrl,
    },
    {
      name: 'iCode',
      description: $localize`:@@ivision-page.ecosystem.icode.description:The website or the application the videos point to — written from the same brand.`,
      href: this.idevUrl,
    },
  ];
}
