import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
})
export class PublicLayoutComponent {}
