import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlineUsers } from './online-users';

describe('OnlineUsers', () => {
  let component: OnlineUsers;
  let fixture: ComponentFixture<OnlineUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnlineUsers],
    }).compileComponents();

    fixture = TestBed.createComponent(OnlineUsers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
