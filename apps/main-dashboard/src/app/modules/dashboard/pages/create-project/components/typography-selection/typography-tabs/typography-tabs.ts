import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type TypographyTab = 'generated' | 'popular' | 'custom';

@Component({
  selector: 'app-typography-tabs',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './typography-tabs.html',
  styleUrls: ['./typography-tabs.css'],
})
export class TypographyTabsComponent {
  @Input() activeTab: TypographyTab = 'generated';
  @Input() hasGeneratedTypographies = false;
  @Output() tabChanged = new EventEmitter<TypographyTab>();

  onTabClick(tab: TypographyTab): void {
    this.tabChanged.emit(tab);
  }
}
