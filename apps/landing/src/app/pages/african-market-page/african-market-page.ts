import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Team } from '../../components/team/team';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

/** Un chiffre du marché, avec ce qu'il mesure vraiment. */
interface MarketFigure {
  value: string;
  label: string;
  description: string;
}

/** Une raison, et la mesure qui la rend vérifiable. */
interface Reason {
  title: string;
  description: string;
  evidence: string;
}

interface Advantage {
  title: string;
  description: string;
}

/** Une région, et l'état réel de son ouverture. */
interface Region {
  name: string;
  status: string;
  description: string;
  countries: string;
}

@Component({
  selector: 'app-african-market-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Team, PageArtComponent],
  templateUrl: './african-market-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './african-market-page.css'],
})
export class AfricanMarketPage {
  protected readonly dashboardUrl = environment.services.dashboard.url;

  protected readonly stats: MarketFigure[] = [
    {
      value: '1,4 Md',
      label: $localize`:@@african-market-page.stat.population.label:People`,
      description: $localize`:@@african-market-page.stat.population.description:Median age nineteen — the youngest population of any continent, heading for 2.5 billion by 2050.`,
    },
    {
      value: '700 M',
      label: $localize`:@@african-market-page.stat.internet.label:Internet users`,
      description: $localize`:@@african-market-page.stat.internet.description:Growing about ten percent a year, and overwhelmingly on a phone rather than a desktop.`,
    },
    {
      value: '44 M',
      label: $localize`:@@african-market-page.stat.smes.label:Small businesses`,
      description: $localize`:@@african-market-page.stat.smes.description:They account for roughly eighty percent of employment on the continent.`,
    },
    {
      value: '500 M',
      label: $localize`:@@african-market-page.stat.mobileMoney.label:Mobile money accounts`,
      description: $localize`:@@african-market-page.stat.mobileMoney.description:Africa carries more mobile money traffic than the rest of the world put together.`,
    },
    {
      value: '22 %',
      label: $localize`:@@african-market-page.stat.entrepreneurship.label:Start a business`,
      description: $localize`:@@african-market-page.stat.entrepreneurship.description:The highest rate of new business creation measured anywhere.`,
    },
    {
      value: '5 200',
      label: $localize`:@@african-market-page.stat.startups.label:Tech companies`,
      description: $localize`:@@african-market-page.stat.startups.description:Active across the continent, three times the count of 2020.`,
    },
  ];

  protected readonly whyAfrica: Reason[] = [
    {
      title: $localize`:@@african-market-page.reason.mobile.title:The phone is the computer`,
      description: $localize`:@@african-market-page.reason.mobile.description:Products designed desktop-first lose most of the market on the first screen. Everything in IDEM is built to be used from a phone.`,
      evidence: $localize`:@@african-market-page.reason.mobile.evidence:More than eight in ten connections are mobile.`,
    },
    {
      title: $localize`:@@african-market-page.reason.payment.title:Payment is the real barrier`,
      description: $localize`:@@african-market-page.reason.payment.description:A card-only checkout stops most would-be customers before the first screen. Topping up a wallet by Mobile Money does not.`,
      evidence: $localize`:@@african-market-page.reason.payment.evidence:Mobile Money live in thirteen countries, billed in CFA francs.`,
    },
    {
      title: $localize`:@@african-market-page.reason.young.title:A generation starting out`,
      description: $localize`:@@african-market-page.reason.young.description:Sixty percent of the continent is under twenty-five, and the people entering the workforce are the ones creating the businesses.`,
      evidence: $localize`:@@african-market-page.reason.young.evidence:Around 200 million young people join the workforce by 2035.`,
    },
    {
      title: $localize`:@@african-market-page.reason.sovereignty.title:Dependence is expensive`,
      description: $localize`:@@african-market-page.reason.sovereignty.description:When the tool, the hosting and the invoice all sit abroad, every price rise and every policy change lands on the entrepreneur.`,
      evidence: $localize`:@@african-market-page.reason.sovereignty.evidence:Apache 2.0, self-hostable, data exportable at any time.`,
    },
  ];

  protected readonly idemAdvantages: Advantage[] = [
    {
      title: $localize`:@@african-market-page.advantage.price.title:Priced in francs, not dollars`,
      description: $localize`:@@african-market-page.advantage.price.description:Every country has its own grid, built from local purchasing power rather than converted from a single currency.`,
    },
    {
      title: $localize`:@@african-market-page.advantage.payment.title:Paid the way people pay`,
      description: $localize`:@@african-market-page.advantage.payment.description:MTN and Orange Mobile Money top up the wallet, and the wallet pays for what you generate.`,
    },
    {
      title: $localize`:@@african-market-page.advantage.language.title:Written in your language`,
      description: $localize`:@@african-market-page.advantage.language.description:French, English and Portuguese today. The deliverables follow the language of your request, not the language of the site.`,
    },
    {
      title: $localize`:@@african-market-page.advantage.accounting.title:Accounts that your bank accepts`,
      description: $localize`:@@african-market-page.advantage.accounting.description:Financial statements follow the SYSCOHADA chart of accounts, so a loan officer in Abidjan or Douala can read them.`,
    },
    {
      title: $localize`:@@african-market-page.advantage.sovereignty.title:Hosting you can point to`,
      description: $localize`:@@african-market-page.advantage.sovereignty.description:Deploy to managed hosting, to your own VPS, or to a machine in your office. The choice stays yours.`,
    },
    {
      title: $localize`:@@african-market-page.advantage.open.title:A platform you can audit`,
      description: $localize`:@@african-market-page.advantage.open.description:African developers can read the code, fix it and run it. That is what sovereignty means in practice.`,
    },
  ];

  protected readonly regions: Region[] = [
    {
      name: $localize`:@@african-market-page.region.central.name:Central Africa`,
      status: $localize`:@@african-market-page.region.central.status:Open`,
      description: $localize`:@@african-market-page.region.central.description:Our home market. We know the registry, the tax calendar and the banks because we went through them ourselves.`,
      countries: $localize`:@@african-market-page.region.central.countries:Cameroon, Gabon, Congo, Chad, Central African Republic`,
    },
    {
      name: $localize`:@@african-market-page.region.west.name:West Africa`,
      status: $localize`:@@african-market-page.region.west.status:Open`,
      description: $localize`:@@african-market-page.region.west.description:The largest tech market on the continent, and the one where Mobile Money coverage is deepest.`,
      countries: $localize`:@@african-market-page.region.west.countries:Nigeria, Ghana, Senegal, Côte d'Ivoire, Benin, Togo, Mali, Burkina Faso`,
    },
    {
      name: $localize`:@@african-market-page.region.east.name:East Africa`,
      status: $localize`:@@african-market-page.region.east.status:Operators being enabled`,
      description: $localize`:@@african-market-page.region.east.description:The platform works today; what remains is a payment agreement with each operator so you can top up locally.`,
      countries: $localize`:@@african-market-page.region.east.countries:Kenya, Rwanda, Tanzania, Uganda`,
    },
    {
      name: $localize`:@@african-market-page.region.south.name:Southern Africa`,
      status: $localize`:@@african-market-page.region.south.status:Card only, for now`,
      description: $localize`:@@african-market-page.region.south.description:The most mature infrastructure on the continent, and the market where we compete head-on with international platforms.`,
      countries: $localize`:@@african-market-page.region.south.countries:South Africa, Botswana, Namibia, Zambia, Zimbabwe`,
    },
  ];
}
