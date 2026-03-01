import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="glass-card navbar">
      <div class="logo text-gradient">CAPITAINE - POKER</div>
      <div class="nav-links">
        <a routerLink="/setup" routerLinkActive="active">Réglages</a>
        <a routerLink="/join" routerLinkActive="active">Rejoindre</a>
        <a routerLink="/game" routerLinkActive="active">Table</a>
        <a routerLink="/info" routerLinkActive="active">Stats</a>
        <a routerLink="/replay" routerLinkActive="active">History</a>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      margin: 20px;
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 20px;
    }
    .logo {
      font-weight: 900;
      font-size: 1.4rem;
      letter-spacing: 0.1em;
    }
    .nav-links {
      display: flex;
      gap: 24px;
    }
    a {
      text-decoration: none;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.95rem;
      transition: var(--transition);
      position: relative;
      padding: 4px 0;
    }
    a:hover {
      color: var(--text-primary);
    }
    a.active {
      color: var(--accent-primary);
    }
    a.active::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      width: 100%;
      height: 2px;
      background: var(--accent-primary);
      box-shadow: 0 0 8px var(--accent-primary);
    }
    
    @media (max-width: 768px) {
      .navbar {
        margin: 10px;
        padding: 12px 20px;
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }
      .logo {
        font-size: 1.1rem;
      }
      .nav-links {
        gap: 15px;
      }
      a {
        font-size: 0.85rem;
      }
    }
  `]
})
export class NavbarComponent { }
