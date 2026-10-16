import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

/** Une cible de génération, et la pile réelle qu'elle produit. */
interface BuildTarget {
  title: string;
  description: string;
  stack: string;
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

@Component({
  selector: 'app-idev-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageArtComponent],
  templateUrl: './idev-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './idev-page.css'],
})
export class IdevPage {
  protected readonly idevUrl = environment.services.idev.url;
  protected readonly ideployUrl = environment.services.ideploy.url;
  protected readonly dashboardUrl = environment.services.dashboard.url;

  /** Les trois cibles que le serveur sait distinguer (`resolveBuildTarget`). */
  protected readonly targets: BuildTarget[] = [
    {
      title: $localize`:@@idev-page.target.site.title:A showcase site`,
      description: $localize`:@@idev-page.target.site.description:Pages that present your business and bring in enquiries. Built from your brand if you already made one with IDEM.`,
      stack: 'React · Vite · Tailwind CSS',
    },
    {
      title: $localize`:@@idev-page.target.web.title:A web application`,
      description: $localize`:@@idev-page.target.web.description:Accounts, forms, a database, pages that do work. The kind of tool you would otherwise run on a spreadsheet.`,
      stack: 'React · Vite · API routes · database',
    },
    {
      title: $localize`:@@idev-page.target.mobile.title:A phone application`,
      description: $localize`:@@idev-page.target.mobile.description:Laid out for a phone, installable straight from its link, and packaged for Android and iOS from the same code.`,
      stack: 'React · Vite · PWA · Capacitor',
    },
  ];

  protected readonly steps: Step[] = [
    {
      title: $localize`:@@idev-page.step.describe.title:Say what you need`,
      description: $localize`:@@idev-page.step.describe.description:Plain sentences, in French or English. « A booking page for my salon, with the opening hours and a deposit » is enough to start.`,
    },
    {
      title: $localize`:@@idev-page.step.build.title:Watch it get written`,
      description: $localize`:@@idev-page.step.build.description:Files appear one after another and the preview reloads as they land. You can read every line while it happens.`,
    },
    {
      title: $localize`:@@idev-page.step.adjust.title:Change it by talking`,
      description: $localize`:@@idev-page.step.adjust.description:« Move the price above the photo », « add a second language ». No file to find, no code to edit by hand unless you want to.`,
    },
    {
      title: $localize`:@@idev-page.step.ship.title:Put it online`,
      description: $localize`:@@idev-page.step.ship.description:One button hands the project to iDeploy and returns a working address with HTTPS. Or export the source and host it yourself.`,
    },
  ];

  protected readonly previewCapabilities: Capability[] = [
    {
      title: $localize`:@@idev-page.preview.container.title:Node runs in the tab`,
      description: $localize`:@@idev-page.preview.container.description:The dev server starts inside your browser. Nothing to install, and the preview is the real project rather than a picture of it.`,
    },
    {
      title: $localize`:@@idev-page.preview.database.title:A real database in the preview`,
      description: $localize`:@@idev-page.preview.database.description:Postgres runs alongside the app, so sign-up, saved records and queries work before anything is deployed.`,
    },
    {
      title: $localize`:@@idev-page.preview.fullstack.title:Front and back together`,
      description: $localize`:@@idev-page.preview.fullstack.description:A full-stack project runs its interface and its API side by side, the way it will run in production.`,
    },
    {
      title: $localize`:@@idev-page.preview.errors.title:Errors come with a fix`,
      description: $localize`:@@idev-page.preview.errors.description:When the build or the page breaks, the error is shown with a « Fix » button that hands it back to the model with the stack trace.`,
    },
    {
      title: $localize`:@@idev-page.preview.phone.title:A phone frame for phone apps`,
      description: $localize`:@@idev-page.preview.phone.description:Mobile projects preview inside an iPhone and an Android mockup, because a phone layout cannot be judged in a desktop window.`,
    },
    {
      title: $localize`:@@idev-page.preview.code.title:The code is not hidden`,
      description: $localize`:@@idev-page.preview.code.description:Open the editor, read any file, edit it directly. The conversation and the editor work on the same project.`,
    },
  ];

  protected readonly ecosystem: EcosystemLink[] = [
    {
      name: $localize`:@@idev-page.ecosystem.idem.name:The IDEM platform`,
      description: $localize`:@@idev-page.ecosystem.idem.description:Brand, business plan, finances, legal papers and communication — everything the application is the front of.`,
      href: this.dashboardUrl,
    },
    {
      name: 'iDeploy',
      description: $localize`:@@idev-page.ecosystem.ideploy.description:Hosting, domain name, certificates and logs, on our machines or on yours.`,
      href: this.ideployUrl,
    },
  ];
}
