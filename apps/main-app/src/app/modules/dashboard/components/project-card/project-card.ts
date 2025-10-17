import { Component, inject, input } from '@angular/core';
import { ProjectModel } from '../../models/project.model';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { CookieService } from '../../../../shared/services/cookie.service';

@Component({
  selector: 'app-project-card',
  imports: [DatePipe],
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
})
export class ProjectCard {
  project = input<ProjectModel>();
  router = inject(Router);
  cookieService = inject(CookieService);

  cardClick(id: string) {
    this.cookieService.set('projectId', id);
    this.router.navigate([`console/dashboard`]);
  }
}
