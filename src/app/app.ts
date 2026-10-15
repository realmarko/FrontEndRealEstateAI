import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { CompareBarComponent } from './shared/components/compare-bar/compare-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CompareBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
