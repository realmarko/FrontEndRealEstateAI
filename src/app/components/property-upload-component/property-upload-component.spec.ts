import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PropertyUploadComponent } from './property-upload-component';

describe('PropertyUploadComponent', () => {
  let component: PropertyUploadComponent;
  let fixture: ComponentFixture<PropertyUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PropertyUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
