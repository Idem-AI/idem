import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

/**
 * Une clause de la licence. `grant` dit en deux mots si c'est un droit ou une
 * limite : le texte de `LICENSE` est une Apache 2.0 **assortie de la Commons
 * Clause**, pas une Apache 2.0 nue, et une page qui annonce « usage commercial
 * sans restriction » dit le contraire de ce que le dépôt accorde.
 */
interface LicenseClause {
  grant: string;
  title: string;
  description: string;
}

interface HostingOption {
  title: string;
  description: string;
}

interface CommunityPlace {
  name: string;
  description: string;
  href: string;
}

@Component({
  selector: 'app-open-source-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageArtComponent],
  templateUrl: './open-source-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './open-source-page.css'],
})
export class OpenSourcePage {
  protected readonly dashboardUrl = environment.services.dashboard.url;

  protected readonly licenseClauses: LicenseClause[] = [
    {
      grant: $localize`:@@open-source-page.clause.read.grant:You may`,
      title: $localize`:@@open-source-page.clause.read.title:Read and audit all of it`,
      description: $localize`:@@open-source-page.clause.read.description:Every line of the platform is public, including how your data is stored and which model handles which request.`,
    },
    {
      grant: $localize`:@@open-source-page.clause.host.grant:You may`,
      title: $localize`:@@open-source-page.clause.host.title:Install it on your own servers`,
      description: $localize`:@@open-source-page.clause.host.description:Run the whole platform inside your company, for your company. No licence fee, no call home.`,
    },
    {
      grant: $localize`:@@open-source-page.clause.clients.grant:You may`,
      title: $localize`:@@open-source-page.clause.clients.title:Deliver client work with it`,
      description: $localize`:@@open-source-page.clause.clients.description:Agencies and freelancers can use IDEM to build for their clients, and charge for that work as they always have.`,
    },
    {
      grant: $localize`:@@open-source-page.clause.modify.grant:You may`,
      title: $localize`:@@open-source-page.clause.modify.title:Change it and share the change`,
      description: $localize`:@@open-source-page.clause.modify.description:Fork it, patch it, redistribute it, as long as the copyright notices stay in place.`,
    },
    {
      grant: $localize`:@@open-source-page.clause.sell.grant:You may not`,
      title: $localize`:@@open-source-page.clause.sell.title:Resell IDEM itself`,
      description: $localize`:@@open-source-page.clause.sell.description:The Commons Clause added to the licence rules out selling the software, or hosting it as a paid service of your own. Write to us if that is what you need.`,
    },
  ];

  protected readonly hostingOptions: HostingOption[] = [
    {
      title: $localize`:@@open-source-page.hosting.managed.title:Our managed hosting`,
      description: $localize`:@@open-source-page.hosting.managed.description:The default. You create a project, we keep the machines running, and your deliverables are downloadable at any point.`,
    },
    {
      title: $localize`:@@open-source-page.hosting.vps.title:Your own VPS`,
      description: $localize`:@@open-source-page.hosting.vps.description:Point iDeploy at a server you rent and it builds there instead. The provider, the country and the invoice are yours.`,
    },
    {
      title: $localize`:@@open-source-page.hosting.onPremise.title:A machine in your office`,
      description: $localize`:@@open-source-page.hosting.onPremise.description:The full platform installs from the repository with Docker. Nothing leaves the building, including the prompts.`,
    },
  ];

  protected readonly communityPlaces: CommunityPlace[] = [
    {
      name: 'GitHub',
      description: $localize`:@@open-source-page.place.github.description:The code, the issues and the roadmap. Pull requests are read.`,
      href: 'https://github.com/Idem-AI',
    },
    {
      name: $localize`:@@open-source-page.place.issues.name:Report a bug`,
      description: $localize`:@@open-source-page.place.issues.description:Open an issue on the repository. Bugs reported in the open get fixed in the open.`,
      href: 'https://github.com/Idem-AI/idem/issues',
    },
    {
      name: $localize`:@@open-source-page.place.releases.name:Release notes`,
      description: $localize`:@@open-source-page.place.releases.description:What changed, version by version, with the commits behind each line.`,
      href: 'https://github.com/Idem-AI/idem/releases',
    },
  ];
}
