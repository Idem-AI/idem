import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-african-market',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './african-market.html',
  styleUrl: './african-market.css',
})
export class AfricanMarketComponent {
  protected readonly markets = [
    {
      region: 'Cameroon',
      flag: '',
      status: 'Live Now',
      description: 'Our home base and launch market',
      color: '#10b981',
    },
    {
      region: 'West Africa',
      flag: '🌍',
      status: 'Expanding',
      description: "Nigeria, Ghana, Senegal, Côte d'Ivoire",
      color: '#3b82f6',
    },
    {
      region: 'East Africa',
      flag: '🌍',
      status: 'Coming Soon',
      description: 'Kenya, Rwanda, Tanzania, Uganda',
      color: '#f59e0b',
    },
    {
      region: 'Southern Africa',
      flag: '🌍',
      status: 'Roadmap',
      description: 'South Africa, Botswana, Namibia',
      color: '#8b5cf6',
    },
  ];

  protected readonly stats = [
    {
      value: '700+',
      label: $localize`:@@african-market.stats.techStartups.label:Tech Startups Created Annually`,
      description: $localize`:@@african-market.stats.techStartups.description:In Cameroon, Nigeria, Kenya, South Africa`,
    },
    {
      value: '2M',
      label: $localize`:@@african-market.stats.potentialEntrepreneurs.label:Potential Entrepreneurs`,
      description: $localize`:@@african-market.stats.potentialEntrepreneurs.description:Across African markets`,
    },
    {
      value: '15M',
      label: $localize`:@@african--market.stats.smesDigitalizing.label:SMEs Digitalizing`,
      description: $localize`:@@african-market.stats.smesDigitalizing.description:African businesses going digital`,
    },
    {
      value: '500K',
      label: $localize`:@@african-market.stats.techProfessionals.label:Tech Professionals`,
      description: $localize`:@@african-market.stats.techProfessionals.description:Developers and digital agencies`,
    },
  ];

  protected readonly advantages = [
    {
      icon: 'pi-globe',
      title: $localize`:@@african-market.advantages.builtForAfrica.title:Built for African Context`,
      description: $localize`:@@african-market.advantages.builtForAfrica.description:Business plans adapted to local markets, visual identities culturally relevant, architectures optimized for African constraints`,
    },
    {
      icon: 'pi-money-bill',
      title: $localize`:@@african-market.advantages.accessiblePricing.title:Accessible Pricing`,
      description: $localize`:@@african-market.advantages.accessiblePricing.description:Ultra-affordable $15/month plans with freemium credits. 60-80% cheaper than international alternatives`,
    },
    {
      icon: 'pi-map',
      title: $localize`:@@african-market.advantages.localInfrastructure.title:Local Infrastructure`,
      description: $localize`:@@african-market.advantages.localInfrastructure.description:Sovereign cloud nodes across Africa. Data stays on the continent with low latency`,
    },
    {
      icon: 'pi-users',
      title: $localize`:@@african-market.advantages.africanCommunity.title:African Community`,
      description: $localize`:@@african-market.advantages.africanCommunity.description:Built by Africans for Africa. Contribute to a pan-African open source ecosystem`,
    },
  ];
}
