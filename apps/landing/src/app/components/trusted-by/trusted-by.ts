import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Partner {
  name: string;
  logo: string;
  url: string;
}

@Component({
  selector: 'app-trusted-by',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trusted-by.html',
  styleUrl: './trusted-by.css',
})
export class TrustedByComponent {
  // Communautés tech camerounaises partenaires
  partners: Partner[] = [

    {
      name: 'GDG Douala',
      logo: '/assets/images/trust-by/gdg douala.png',
      url: 'https://gdg.community.dev/gdg-douala/',
    },

    {
      name: '.NET Cameroun',
      logo: '/assets/images/trust-by/dotnet cameroun logo.png',
      url: 'https://dotnet.cm',
    },
    {
      name: 'AWS User Group Douala',
      logo: '/assets/images/trust-by/aws user group douala.png',
      url: 'https://www.meetup.com/awsugdouala/',
    },
    {
      name: 'Orange S.A.',
      logo: '/assets/images/trust-by/orange logo.svg',
      url: 'https://www.orange.com',
    },
    {
      name: '10000 Codeurs',
      logo: '/assets/images/trust-by/10000codeurs-logo.png',
      url: 'https://10000codeurs.com',
    },
    {
      name: 'DevGirls',
      logo: '/assets/images/trust-by/devgirl logo 1.png',
      url: 'https://www.devgirls.org/home',
    },
    {
      name: 'AWS User Group Yaoundé',
      logo: '/assets/images/trust-by/aws user group yaounde.png',
      url: 'https://www.meetup.com/aws-user-group-yaounde/',
    },
    {
      name: 'OSS Cameroun',
      logo: '/assets/images/trust-by/oss cameroun logo.png',
      url: 'https://osscameroon.com',
    },

    {
      name: 'Rhopen Labs',
      logo: '/assets/images/trust-by/rhopen labs logo.png',
      url: 'https://rhopenlabs.africa',
    },
    {
      name: 'RAVISA',
      logo: '/assets/images/trust-by/RAVISA_2 2 1.png',
      url: 'https://ravisa.org/index.html',
    },
  ];
}
