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
      flag: '🇨🇲',
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
      label: 'Tech Startups Created Annually',
      description: 'In Cameroon, Nigeria, Kenya, South Africa',
    },
    {
      value: '2M',
      label: 'Potential Entrepreneurs',
      description: 'Across African markets',
    },
    {
      value: '15M',
      label: 'SMEs Digitalizing',
      description: 'African businesses going digital',
    },
    {
      value: '500K',
      label: 'Tech Professionals',
      description: 'Developers and digital agencies',
    },
  ];

  protected readonly advantages = [
    {
      icon: 'pi-globe',
      title: 'Built for African Context',
      description:
        'Business plans adapted to local markets, visual identities culturally relevant, architectures optimized for African constraints',
    },
    {
      icon: 'pi-money-bill',
      title: 'Accessible Pricing',
      description:
        'Ultra-affordable $15/month plans with freemium credits. 60-80% cheaper than international alternatives',
    },
    {
      icon: 'pi-map',
      title: 'Local Infrastructure',
      description:
        'Sovereign cloud nodes across Africa. Data stays on the continent with low latency',
    },
    {
      icon: 'pi-users',
      title: 'African Community',
      description:
        'Built by Africans for Africa. Contribute to a pan-African open source ecosystem',
    },
  ];
}
