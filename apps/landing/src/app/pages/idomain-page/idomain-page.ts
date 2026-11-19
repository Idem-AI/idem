import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

/** Une étape de l'installation, avec le délai réel annoncé par iDomain. */
interface SetupStep {
  title: string;
  description: string;
  when: string;
}

interface Included {
  title: string;
  description: string;
}

interface Guarantee {
  title: string;
  description: string;
}

interface EcosystemLink {
  name: string;
  description: string;
  href: string;
}

/**
 * La page de présentation d'iDomain sur la landing.
 *
 * Le contenu vient de l'application (`apps/idomain/web`, ses textes
 * d'accueil) : les quatre étapes d'après paiement avec leurs délais, ce qui est
 * inclus, les trois garanties, l'achat depuis iDeploy et iCode. Les prix ne
 * sont **pas** repris ici : ils varient par extension et par pays, et une page
 * qui les fige finirait par mentir. Elle renvoie à la recherche, qui les donne.
 */
@Component({
  selector: 'app-idomain-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageArtComponent],
  templateUrl: './idomain-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './idomain-page.css'],
})
export class IdomainPage {
  protected readonly idomainUrl = environment.services.idomain.url;
  protected readonly ideployUrl = environment.services.ideploy.url;
  protected readonly idevUrl = environment.services.idev.url;

  /** Ce qui se passe après le paiement, avec les délais que l'écran annonce. */
  protected readonly setup: SetupStep[] = [
    {
      title: $localize`:@@idomain-page.setup.paid.title:Payment received`,
      description: $localize`:@@idomain-page.setup.paid.description:Debited from your IDEM wallet, topped up by mobile money. No card, no bank form.`,
      when: $localize`:@@idomain-page.setup.paid.when:straight away`,
    },
    {
      title: $localize`:@@idomain-page.setup.registered.title:Name registered in your name`,
      description: $localize`:@@idomain-page.setup.registered.description:You are the holder — not us. The name is yours, and you can take it to another registrar whenever you want.`,
      when: $localize`:@@idomain-page.setup.registered.when:under a minute`,
    },
    {
      title: $localize`:@@idomain-page.setup.connected.title:Address written, site connected`,
      description: $localize`:@@idomain-page.setup.connected.description:The DNS records are written for you and your application answers to that name. You open no technical panel.`,
      when: $localize`:@@idomain-page.setup.connected.when:a few minutes`,
    },
    {
      title: $localize`:@@idomain-page.setup.secured.title:HTTPS padlock switched on`,
      description: $localize`:@@idomain-page.setup.secured.description:The certificate is obtained and renewed on its own. Your visitors see a site they can trust.`,
      when: $localize`:@@idomain-page.setup.secured.when:a few minutes`,
    },
  ];

  protected readonly included: Included[] = [
    {
      title: $localize`:@@idomain-page.included.dns.title:DNS managed for you`,
      description: $localize`:@@idomain-page.included.dns.description:Your site’s address is written and kept up to date. The advanced records are there if you want them, hidden if you do not.`,
    },
    {
      title: $localize`:@@idomain-page.included.https.title:Automatic HTTPS`,
      description: $localize`:@@idomain-page.included.https.description:The padlock is obtained and renewed without you doing anything, for as long as the name is connected.`,
    },
    {
      title: $localize`:@@idomain-page.included.connect.title:Connected to your application`,
      description: $localize`:@@idomain-page.included.connect.description:One move attaches the name to the site you just put online with iDeploy or iCode.`,
    },
    {
      title: $localize`:@@idomain-page.included.mail.title:Your mail stays where it is`,
      description: $localize`:@@idomain-page.included.mail.description:Connecting your site touches only its address. Your e-mail and your other records are never overwritten.`,
    },
    {
      title: $localize`:@@idomain-page.included.reminders.title:Reminders before the deadline`,
      description: $localize`:@@idomain-page.included.reminders.description:You are warned ahead of time, with the renewal price. A name is not lost because an e-mail went missing.`,
    },
    {
      title: $localize`:@@idomain-page.included.manage.title:One place for everything`,
      description: $localize`:@@idomain-page.included.manage.description:State, deadline, advanced DNS, transfer code — in your language, in one screen.`,
    },
  ];

  protected readonly guarantees: Guarantee[] = [
    {
      title: $localize`:@@idomain-page.guarantee.price.title:The price you saw is the price you pay`,
      description: $localize`:@@idomain-page.guarantee.price.description:It is held for the whole of your order, even if a rate changes in between. The renewal price is shown before you pay, not a year later.`,
    },
    {
      title: $localize`:@@idomain-page.guarantee.refund.title:Refunded if the name gets away`,
      description: $localize`:@@idomain-page.guarantee.refund.description:If someone registers it first, the amount goes back into your wallet automatically. You do not have to ask.`,
    },
    {
      title: $localize`:@@idomain-page.guarantee.holder.title:The name is yours, and it leaves with you`,
      description: $localize`:@@idomain-page.guarantee.holder.description:You are the registered holder. Ask for the transfer code and we hand it over, free of charge — that is the only real guarantee there is.`,
    },
  ];

  protected readonly ecosystem: EcosystemLink[] = [
    {
      name: 'iDeploy',
      description: $localize`:@@idomain-page.ecosystem.ideploy.description:The hosting the name points at. Buy the name from inside iDeploy and it connects itself.`,
      href: this.ideployUrl,
    },
    {
      name: 'iCode',
      description: $localize`:@@idomain-page.ecosystem.icode.description:The site or the application the name is for — written, then put online, then named.`,
      href: this.idevUrl,
    },
  ];
}
