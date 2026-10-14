import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-platform-home',
  templateUrl: './platform-home.component.html',
  styleUrl: './platform-home.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PlatformHomeComponent {}
