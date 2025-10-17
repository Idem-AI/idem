import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateDeployment } from './create-deployment';

describe('CreateDeployment', () => {
  let component: CreateDeployment;
  let fixture: ComponentFixture<CreateDeployment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateDeployment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateDeployment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
