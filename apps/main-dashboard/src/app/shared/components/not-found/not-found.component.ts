import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ErrorStateComponent } from '../error-state/error-state';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  imports: [RouterLink, TranslateModule, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
