import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-show-tests',
  imports: [],
  templateUrl: './show-tests.html',
  styleUrl: './show-tests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowTestsComponent { }
