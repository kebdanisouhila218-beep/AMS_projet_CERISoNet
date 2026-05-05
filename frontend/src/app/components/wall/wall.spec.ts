import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Wall } from './wall';

describe('Wall', () => {
  let component: Wall;
  let fixture: ComponentFixture<Wall>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Wall],
    }).compileComponents();

    fixture = TestBed.createComponent(Wall);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
