import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimatedStripComponent } from './animated-strip.component';
import { stripSpeedSeconds } from './strip-motifs';

describe('AnimatedStripComponent', () => {
  let fixture: ComponentFixture<AnimatedStripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimatedStripComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AnimatedStripComponent);
  });

  it('renders a duplicated rail and is aria-hidden', () => {
    fixture.componentRef.setInput('enabled', true);
    fixture.componentRef.setInput('motif', 'tesoura');
    fixture.detectChanges();

    const root = fixture.nativeElement.querySelector('[data-animated-strip]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.getAttribute('data-motif')).toBe('tesoura');
    expect(fixture.nativeElement.querySelectorAll('[data-rail]').length).toBe(2);
  });

  it('defaults direction to left (direita → esquerda)', () => {
    fixture.componentRef.setInput('motif', 'pizza');
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector('[data-animated-strip]');
    expect(root.getAttribute('data-direction')).toBe('left');
    expect(fixture.nativeElement.querySelector('.track-reverse')).toBeNull();
  });

  it('does not render when disabled or motif is none', () => {
    fixture.componentRef.setInput('enabled', false);
    fixture.componentRef.setInput('motif', 'pizza');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-animated-strip]')).toBeNull();

    fixture.componentRef.setInput('enabled', true);
    fixture.componentRef.setInput('motif', 'none');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-animated-strip]')).toBeNull();
  });

  it('maps speed presets to positive durations', () => {
    expect(stripSpeedSeconds('slow')).toBeGreaterThan(stripSpeedSeconds('fast'));
    expect(stripSpeedSeconds(18)).toBe(18);
  });
});
