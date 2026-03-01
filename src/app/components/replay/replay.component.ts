import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerService } from '../../services/poker.service';
import { Observable } from 'rxjs';
import { GameState, HandReplay, Card } from '../../models/poker.model';

@Component({
  selector: 'app-replay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="game$ | async as state" class="replay-container">
      <div class="header-actions">
        <h1 class="text-gradient">Historique des mains</h1>
        <div class="header-right">
          <div class="view-toggle">
            <button [class.active]="viewMode === 'chips'" (click)="viewMode = 'chips'">JETONS</button>
            <button [class.active]="viewMode === 'bb'" (click)="viewMode = 'bb'">BB</button>
          </div>
          <div class="stats-badge glass-card">
            {{ state.savedHands.length }} mains enregistrées
          </div>
        </div>
      </div>

      <div class="replays-grid">
        <div *ngFor="let hand of state.savedHands" class="glass-card replay-card">
          <div class="replay-header">
            <span class="timestamp">{{ hand.timestamp | date:'shortTime' }}</span>
            <span class="pot-badge text-gradient">POT: 
              <span *ngIf="viewMode === 'chips'">{{ hand.pot }}</span>
              <span *ngIf="viewMode === 'bb'">{{ (hand.pot / getBigBlind(hand)) | number:'1.1-1' }} BB</span>
            </span>
          </div>

          <div class="community-row">
            <div *ngFor="let card of hand.communityCards" 
                 class="poker-card-real mini" 
                 [ngClass]="'suit-' + card.suit">
              <span class="rank">{{ card.rank }}</span>
              <span class="suit-icon">{{ getSuitChar(card.suit) }}</span>
            </div>
            <div *ngFor="let i of [].constructor(5 - hand.communityCards.length)" class="card-placeholder mini"></div>
          </div>

          <div class="players-recap">
            <div *ngFor="let p of hand.players" class="player-replay-row" [class.winner]="p.isWinner">
              <div class="p-info">
                <div class="name-row">
                    <span class="p-name">{{ p.name }}</span>
                    <div class="name-badges">
                      <span class="all-in-badge-mini" *ngIf="p.isAllIn">TAPIS</span>
                      <span class="status-badge-mini eliminated" *ngIf="p.isEliminated">KICKOUT</span>
                      <span class="status-badge-mini rebought" *ngIf="p.isRebought">RECAVE</span>
                    </div>
                 </div>
                <span class="p-win" [class.negative]="p.winAmount < 0" *ngIf="p.winAmount !== 0">
                  <span *ngIf="viewMode === 'chips'">{{ p.winAmount > 0 ? '+' : '' }}{{ p.winAmount }}</span>
                  <span *ngIf="viewMode === 'bb'">{{ p.winAmount > 0 ? '+' : '' }}{{ (p.winAmount / getBigBlind(hand)) | number:'1.1-1' }} BB</span>
                </span>
              </div>
              <div class="p-cards">
                <div *ngFor="let card of p.holeCards" 
                     class="poker-card-real mini" 
                     [ngClass]="'suit-' + card.suit">
                  <span class="rank">{{ card.rank }}</span>
                  <span class="suit-icon">{{ getSuitChar(card.suit) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="state.savedHands.length === 0" class="no-data glass-card">
        <h3>Aucune main enregistrée</h3>
        <p>Enregistrez vos plus gros coups à la fin d'une main pour les retrouver ici !</p>
      </div>
    </div>
  `,
  styles: [`
    .replay-container {
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .header-actions { display: flex; justify-content: space-between; align-items: center; }
    .header-right { display: flex; align-items: center; gap: 20px; }
    .stats-badge { padding: 10px 20px; font-weight: 700; color: var(--accent-primary); }

    .view-toggle {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      padding: 4px;
      border-radius: 10px;
      border: 1px solid var(--card-border);
    }
    .view-toggle button {
      padding: 6px 12px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 0.7rem;
      font-weight: 800;
      cursor: pointer;
      transition: var(--transition);
    }
    .view-toggle button.active {
      background: var(--accent-primary);
      color: #000;
    }

    .replays-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    
    .replay-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: var(--transition);
    }
    .replay-card:hover { transform: translateY(-4px); border-color: var(--accent-primary); }
    
    .replay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 10px;
    }
    .timestamp { font-size: 0.8rem; color: var(--text-secondary); }
    .pot-badge { font-weight: 900; font-size: 1.2rem; }

    .community-row {
      display: flex;
      gap: 6px;
      justify-content: center;
      padding: 10px 0;
      background: rgba(0,0,0,0.2);
      border-radius: 12px;
    }

    .players-recap { display: flex; flex-direction: column; gap: 8px; }
    .player-replay-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 10px;
    }
    .player-replay-row.winner {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .p-info { display: flex; flex-direction: column; }
    .p-name { font-weight: 700; font-size: 0.9rem; }
    .name-row { display: flex; align-items: center; gap: 6px; }
    .p-win { font-size: 0.8rem; color: var(--success); font-weight: 900; }
    .p-win.negative { color: var(--danger); }
    .p-cards { display: flex; gap: 4px; }

    .all-in-badge-mini {
      font-size: 0.6rem;
      background: var(--accent-secondary);
      color: white;
      padding: 1px 4px;
      border-radius: 4px;
      font-weight: 900;
    }
    .name-badges { display: flex; gap: 3px; align-items: center; }
    .status-badge-mini { 
      font-size: 0.55rem; 
      padding: 1px 4px; 
      border-radius: 3px; 
      font-weight: 900; 
      color: white; 
    }
    .status-badge-mini.eliminated { background: var(--danger); }
    .status-badge-mini.rebought { background: var(--warning); color: #000; }

    .no-data {
      padding: 60px;
      text-align: center;
      color: var(--text-secondary);
    }
    
    @media (max-width: 768px) {
      .replay-container {
        padding: 20px 10px;
      }
      .header-actions {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }
      .replays-grid {
        grid-template-columns: 1fr;
      }
      .replay-card {
        padding: 15px;
      }
    }

    @media (max-width: 480px) {
      .replay-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
      }
    }
    
    .card-placeholder.mini { width: 32px; height: 48px; border-radius: 4px; }
  `]
})
export class ReplayComponent {
  game$: Observable<GameState>;
  viewMode: 'chips' | 'bb' = 'chips';

  constructor(private pokerService: PokerService) {
    this.game$ = this.pokerService.game$;
  }

  getBigBlind(hand: HandReplay): number {
    return hand.bigBlind || 10;
  }

  getSuitChar(suit: string): string {
    const chars: Record<string, string> = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    return chars[suit] || '';
  }
}
