import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyLayout } from './empty-layout';

describe('EmptyLayout', () => {
  let component: EmptyLayout;
  let fixture: ComponentFixture<EmptyLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyLayout]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmptyLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
