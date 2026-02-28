import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerService } from '../../services/poker.service';
import { Observable } from 'rxjs';
import { GameState, Player } from '../../models/poker.model';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="game$ | async as state" class="info-container">
      <div class="header-actions">
        <div class="title-group">
          <h1 class="text-gradient">Informations</h1>
          <div class="display-toggle glass-card">
            <div class="toggle-btns">
              <button [class.active]="displayMode === 'cards'" (click)="displayMode = 'cards'">🎴 Cartes</button>
              <button [class.active]="displayMode === 'ranking'" (click)="displayMode = 'ranking'">🏆 Classement</button>
            </div>
            <div class="divider"></div>
            <div class="toggle-btns">
              <button [class.active]="unitMode === 'chips'" (click)="unitMode = 'chips'">Chips</button>
              <button [class.active]="unitMode === 'bb'" (click)="unitMode = 'bb'">BB</button>
            </div>
          </div>
        </div>
        <button (click)="resetGame()" class="btn-reset">Nouvelle partie 🔄</button>
      </div>

      <div class="stats-grid" *ngIf="displayMode === 'cards'">
        <div *ngFor="let p of state.players" class="glass-card stat-card" [class.eliminated]="p.isEliminated">
          <div class="card-header">
            <h3>{{ p.name }}</h3>
            <span class="chip-total text-gradient" [innerHTML]="formatValue(p.chips, state.bigBlind)"></span>
          </div>
          
          <div class="stats-details">
            <div class="compact-row">
              <span class="label">Recave ({{ p.rebuyCount }})</span>
              <button (click)="rebuy(p.id)" class="rebuy-btn">+ Recave</button>
            </div>
            
            <div class="stat-row">
              <span class="label">P-F/Flop Folds</span>
              <span class="value">{{ p.stats.preFlopFolds }} / {{ p.stats.flopFolds }}</span>
            </div>
            
            <div class="stat-row">
              <span class="label">Turn/Riv Folds</span>
              <span class="value">{{ p.stats.turnFolds }} / {{ p.stats.riverFolds }}</span>
            </div>

            <div class="stat-row">
              <span class="label">Raises/All-ins</span>
              <span class="value">{{ p.stats.raises }} / {{ p.stats.allIns }}</span>
            </div>

            <div class="stat-row">
              <span class="label">Played / Won</span>
              <span class="value">{{ calculatePercentage(p.stats.voluntarilyPlayed, p.stats.totalHands) }}% / {{ p.stats.handsWon }}</span>
            </div>

            <div class="stat-row">
              <span class="label">KO (Elim.)</span>
              <span class="value text-accent">{{ p.stats.eliminations }}</span>
            </div>

            <div class="stat-row highlight">
              <span class="label">H-Received</span>
              <span class="value">{{ p.stats.totalHands }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Ranking View -->
      <div class="ranking-container glass-card" *ngIf="displayMode === 'ranking'">
        <table class="ranking-table">
          <thead>
            <tr>
              <th class="rank-col">#</th>
              <th>JOUEUR</th>
              <th class="text-right chips-col">JETONS</th>
              <th class="text-center ko-col">K.O (Éliminés)</th>
              <th class="text-center won-col">MAINS GAGNÉES</th>
              <th class="text-center rebuy-col">RECAVES</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of getSortedPlayers(state.players); let i = index" [class.eliminated-row]="p.isEliminated">
              <td class="rank-cell">
                 <span *ngIf="!p.isEliminated" class="rank-num">{{ i + 1 }}</span>
                 <span *ngIf="p.isEliminated" class="rank-out">OUT</span>
              </td>
              <td class="name-cell">
                <div class="player-name-group">
                  <strong>{{ p.name }}</strong>
                </div>
              </td>
              <td class="chips-cell text-right">
                <span [class.text-gradient]="!p.isEliminated" [innerHTML]="formatValue(p.chips, state.bigBlind)"></span>
              </td>
              <td class="text-center">
                <span class="ko-badge">{{ p.stats.eliminations }}</span>
              </td>
              <td class="text-center">{{ p.stats.handsWon }}</td>
              <td class="text-center">{{ p.rebuyCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .info-container {
      padding: 40px;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      gap: 20px;
    }
    .title-group {
      display: flex;
      align-items: center;
      gap: 30px;
    }
    .display-toggle {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 6px 16px;
      border-radius: 12px;
    }
    .divider {
      width: 1px;
      height: 24px;
      background: rgba(255,255,255,0.1);
    }
    .toggle-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
    }
    .toggle-btns {
      display: flex;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      overflow: hidden;
    }
    .toggle-btns button {
      padding: 6px 14px;
      border-radius: 0;
      background: transparent;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-secondary);
    }
    .toggle-btns button.active {
      background: var(--accent-primary);
      color: #000;
    }

    .btn-reset {
      background: var(--danger);
      color: white;
      padding: 12px 24px;
      font-size: 1rem;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .stat-card {
      padding: 16px;
      gap: 12px;
    }
    .eliminated {
      opacity: 0.5;
      filter: grayscale(1);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 12px;
    }
    .chip-total {
      font-weight: 800;
      font-size: 1.1rem;
    }
    .stats-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .compact-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .label { color: var(--text-secondary); font-size: 0.8rem; font-weight: 500; }
    .value { font-weight: 700; font-size: 0.95rem; }
    .text-accent { color: var(--accent-primary); }

    /* Ranking Styles */
    .ranking-container { padding: 0; overflow: hidden; }
    .ranking-table { width: 100%; border-collapse: collapse; }
    .ranking-table th { 
      background: rgba(255,255,255,0.05); 
      padding: 16px; 
      text-align: left; 
      font-size: 0.75rem; 
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 2px solid rgba(255,255,255,0.1);
    }
    .rank-col { width: 60px; text-align: center !important; }
    .chips-col { width: 150px; }
    .ko-col { width: 150px; }
    .won-col { width: 150px; }
    .rebuy-col { width: 120px; }
    .ranking-table td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .eliminated-row { opacity: 0.5; background: rgba(0,0,0,0.2); }
    .rank-num {
      background: var(--accent-primary);
      color: #000;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: 900;
      font-size: 0.8rem;
    }
    .rank-out { font-size: 0.7rem; font-weight: 800; color: var(--danger); }
    .ko-badge {
      background: rgba(56, 189, 248, 0.2);
      color: var(--accent-primary);
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 800;
    }
  `]
})
export class InfoComponent {
  game$: Observable<GameState>;
  displayMode: 'cards' | 'ranking' = 'ranking';
  unitMode: 'chips' | 'bb' = 'chips';

  constructor(private pokerService: PokerService, private router: Router) {
    this.game$ = this.pokerService.game$;
  }

  formatValue(value: number, bigBlind: number): string {
    if (this.unitMode === 'bb') {
      return (value / bigBlind).toFixed(1) + ' BB';
    }
    return `<span><span class="poker-chip"></span>${value.toLocaleString()}</span>`;
  }

  calculatePercentage(part: number, total: number): string {
    if (!total || total === 0) return '0';
    return ((part / total) * 100).toFixed(0);
  }

  getSortedPlayers(players: Player[]): Player[] {
    return [...players].sort((a, b) => {
      if (a.isEliminated && !b.isEliminated) return 1;
      if (!a.isEliminated && b.isEliminated) return -1;
      return b.chips - a.chips;
    });
  }

  rebuy(playerId: string) {
    const amountStr = prompt('Rebuy amount?');
    if (amountStr) {
      const amount = Number(amountStr);
      if (!isNaN(amount) && amount > 0) {
        this.pokerService.rebuy(playerId, amount);
      }
    }
  }

  resetGame() {
    if (confirm('Êtes-vous sûr de vouloir recommencer un tout nouveau tournoi ? Cela effacera tous les joueurs et les statistiques.')) {
      this.pokerService.resetGame();
      this.router.navigate(['/setup']);
    }
  }
}
