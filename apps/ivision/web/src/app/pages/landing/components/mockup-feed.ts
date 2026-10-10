import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { MockupPhone } from './mockup-phone';
import { ScenePlayer } from './scene-player';

/**
 * La vidéo en publication (4:5) dans un fil d'actualité : le compte de la marque, la vidéo, les
 * gestes (aimer, commenter, partager, garder), la légende, et la publication suivante qui pointe.
 */
@Component({
  selector: 'iv-mockup-feed',
  imports: [TranslateModule, MockupPhone, ScenePlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <iv-mockup-phone>
      <div class="feed">
        <div class="head">
          <span class="avatar"><span>{{ 'landing.demo.monogram' | translate }}</span></span>
          <span class="name">{{ 'landing.mockups.handle' | translate }}</span>
          <i class="pi pi-ellipsis-h"></i>
        </div>
        <iv-scene-player class="media" [scene]="scene()" [previous]="previous()" />
        <div class="actions">
          <i class="pi pi-heart"></i>
          <i class="pi pi-comment"></i>
          <i class="pi pi-send"></i>
          <i class="pi pi-bookmark save"></i>
        </div>
        <p class="caption"><b>{{ 'landing.mockups.handle' | translate }}</b> {{ 'landing.mockups.caption' | translate }}</p>
        <div class="head next">
          <span class="avatar ghost"></span>
          <span class="line"></span>
        </div>
      </div>
    </iv-mockup-phone>
  `,
  styles: `
    .feed {
      display: flex;
      flex-direction: column;
      gap: 3cqw;
      height: 100%;
      padding-top: 13cqw;
      color: var(--color-secondary-500);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 2.6cqw;
      padding: 0 4.5cqw;
      font-size: 4.4cqw;
    }
    .name {
      flex: 1;
      font-weight: 700;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 8.5cqw;
      height: 8.5cqw;
      border-radius: 50%;
      background: var(--color-primary-500);
      color: var(--color-on-primary);
      font-size: 4.2cqw;
      font-weight: 900;
    }
    .media {
      aspect-ratio: 4 / 5;
      flex-shrink: 0;
    }
    .actions {
      display: flex;
      gap: 4.4cqw;
      padding: 0 4.5cqw;
      font-size: 6.2cqw;
    }
    .save {
      margin-left: auto;
    }
    .caption {
      padding: 0 4.5cqw;
      font-size: 4cqw;
      line-height: 1.35;
    }
    .next {
      margin-top: 2cqw;
      opacity: 0.35;
    }
    .ghost {
      background: var(--color-secondary-500);
    }
    .line {
      width: 40%;
      height: 2.4cqw;
      border-radius: 1.2cqw;
      background: var(--color-secondary-500);
    }
  `,
})
export class MockupFeed {
  readonly scene = input(0);
  readonly previous = input(-1);
}
