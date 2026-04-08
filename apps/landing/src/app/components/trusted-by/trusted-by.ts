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
  // Ajoutez facilement de nouveaux partenaires dans cette liste
  partners: Partner[] = [
    {
      name: 'Google',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
      url: 'https://google.com'
    },
    {
      name: 'Microsoft',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg',
      url: 'https://microsoft.com'
    },
    {
      name: 'Amazon',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
      url: 'https://amazon.com'
    },
    {
      name: 'Meta',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg',
      url: 'https://meta.com'
    },
  ];
}
