import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-show-tests',
  imports: [TranslateModule],
  templateUrl: './show-tests.html',
  styleUrl: './show-tests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowTestsComponent {}
