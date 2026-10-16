import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DIVIDER_SHAPES, dividerPath } from './divider-path';
import { SectionDividerComponent } from './section-divider.component';

describe('SectionDividerComponent', () => {
  let fixture: ComponentFixture<SectionDividerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectionDividerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SectionDividerComponent);
  });

  it('exposes a non-empty path for every SVG shape', () => {
    for (const shape of DIVIDER_SHAPES) {
      const path = dividerPath(shape);
      if (shape === 'reta' || shape === 'none') {
        expect(path).toBe('');
      } else {
        expect(path.length).toBeGreaterThan(0);
      }
    }
  });

  it('renders SVG with aria-hidden and reserved height for ondulada', () => {
    fixture.componentRef.setInput('shape', 'ondulada');
    fixture.componentRef.setInput('height', 64);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg[data-section-divider]');
    expect(svg).withContext('svg').toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.style.height).toBe('64px');
    expect(svg.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(0);
  });

  it('does not render SVG for reta', () => {
    fixture.componentRef.setInput('shape', 'reta');
    fixture.componentRef.setInput('height', 40);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    const flat = fixture.nativeElement.querySelector('[data-shape="reta"]');
    expect(flat).toBeTruthy();
    expect(flat.getAttribute('aria-hidden')).toBe('true');
    expect(flat.style.height).toBe('40px');
  });

  it('applies flip via scaleX(-1) transform', () => {
    fixture.componentRef.setInput('shape', 'serrilhada');
    fixture.componentRef.setInput('flip', true);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.style.transform).toContain('scaleX(-1)');
    expect(fixture.nativeElement.getAttribute('data-flip')).toBe('true');
  });

  it('clamps height between 16 and 120', () => {
    fixture.componentRef.setInput('shape', 'curva');
    fixture.componentRef.setInput('height', 4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg').style.height).toBe('16px');

    fixture.componentRef.setInput('height', 200);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg').style.height).toBe('120px');
  });
});
