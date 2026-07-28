import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Service {
  readonly name: string;
  readonly descriptor: string;
  readonly price: string;
  readonly link?: string;
}

interface ServiceGroup {
  readonly title: string;
  readonly services: readonly Service[];
}

@Component({
  selector: 'app-offer-ecosystem',
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offer-ecosystem.html',
  styleUrl: './offer-ecosystem.css',
})
export class OfferEcosystemComponent {
  protected readonly groups: readonly ServiceGroup[] = [
    {
      title: $localize`:@@offer.group.structure:Structure`,
      services: [
        {
          name: 'IDEM Business',
          descriptor: $localize`:@@offer.business.desc:Brand, business plan, OHADA legal`,
          price: $localize`:@@offer.business.price:Packs from 1,999 F`,
          link: '/pricing',
        },
        {
          name: 'IDEM Media',
          descriptor: $localize`:@@offer.media.desc:Social networks on autopilot`,
          price: $localize`:@@offer.media.price:1,999–4,999 F/mo`,
          link: '/pricing',
        },
      ],
    },
    {
      title: $localize`:@@offer.group.build:Build & ship`,
      services: [
        {
          name: 'iCode',
          descriptor: $localize`:@@offer.code.desc:AI-generated web apps`,
          price: $localize`:@@offer.code.price:Free · Pass 999 F`,
          link: '/idev',
        },
        {
          name: 'iDeploy',
          descriptor: $localize`:@@offer.ideploy.desc:Sovereign hosting, free domain`,
          price: $localize`:@@offer.ideploy.price:5 deployments free`,
          link: '/ideploy',
        },
      ],
    },
    {
      title: $localize`:@@offer.group.grow:Support & partners`,
      services: [
        {
          name: 'IDEM Conseil',
          descriptor: $localize`:@@offer.conseil.desc:Certified advisors + funding intros`,
          price: $localize`:@@offer.conseil.price:from 2,500 F/mo`,
          link: '/contact',
        },
        {
          name: 'IDEM for Partners',
          descriptor: $localize`:@@offer.partners.desc:Incubators, accelerators, campuses`,
          price: $localize`:@@offer.partners.price:from 20,000 F/founder`,
          link: '/contact',
        },
        {
          name: 'Marketplace',
          descriptor: $localize`:@@offer.marketplace.desc:Templates & advisor certification`,
          price: $localize`:@@offer.marketplace.price:15–30% commission`,
        },
        {
          name: 'IDEM Enterprise',
          descriptor: $localize`:@@offer.enterprise.desc:On-premise licenses, gov & banks`,
          price: $localize`:@@offer.enterprise.price:from 15M F/yr`,
          link: '/contact',
        },
        {
          name: 'IDEM Venture',
          descriptor: $localize`:@@offer.venture.desc:Premium access for selected founders`,
          price: $localize`:@@offer.venture.price:for 3–7% equity`,
        },
      ],
    },
  ];
}
