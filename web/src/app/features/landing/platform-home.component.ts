import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-platform-home',
  templateUrl: './platform-home.component.html',
  styleUrl: './platform-home.component.scss',
})
export class PlatformHomeComponent {
  @Input({ required: true }) mode!: 'landing' | 'app';
}
