import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerService } from '../../services/poker.service';
import { GameState } from '../../models/poker.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-join-game',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="join-container">
      <div class="glass-card list-card">
        <h1 class="text-gradient">Rejoindre une partie</h1>
        <p class="subtitle" *ngIf="!selectedGameId">Sélectionnez une table active pour rejoindre</p>
        <p class="subtitle" *ngIf="selectedGameId">Choisissez votre rôle pour la partie <strong>{{ selectedGameId }}</strong></p>
        
        <!-- Refresh Button for list view -->
        <button *ngIf="!loading && !selectedGameId && games.length > 0" class="refresh-btn fab" (click)="refresh()" [disabled]="loading">
             🔄
        </button>

        <div *ngIf="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Recherche des tables...</p>
        </div>

        <!-- No Games Found -->
        <div *ngIf="!loading && !selectedGameId && games.length === 0" class="empty-state">
          <div class="empty-icon">🎴</div>
          <p>Aucune partie en cours trouvée.</p>
          <button class="refresh-btn" (click)="refresh()">
            <span>🔄</span> Actualiser
          </button>
        </div>

        <!-- Game List -->
        <div *ngIf="!loading && !selectedGameId && games.length > 0" class="game-list">
          <div *ngFor="let game of games" class="game-item glass-card" (click)="selectGame(game.id)">
            <div class="game-info">
              <div class="game-header">
                <span class="room-id">{{ game.id }}</span>
                <span class="status-badge" [class.in-progress]="game.state.players.length > 0">
                  {{ game.state.currentPhase | uppercase }}
                </span>
              </div>
              <div class="game-details">
                <div class="detail">
                  <span class="icon">👥</span>
                  <span class="value">{{ game.state.players.length }} Joueurs</span>
                </div>
                <div class="detail">
                  <span class="icon">💰</span>
                  <span class="value">{{ game.state.smallBlind }}/{{ game.state.bigBlind }}</span>
                </div>
                <div class="detail">
                  <span class="icon">🏦</span>
                  <span class="value">{{ game.state.pot }} pot</span>
                </div>
              </div>
            </div>
            <div class="join-arrow">➜</div>
          </div>
        </div>

        <!-- Role Selection -->
        <div *ngIf="!loading && selectedGameId" class="role-selection">
          <div class="role-options">
            <div class="role-card glass-card" (click)="join('dealer')">
              <div class="role-icon">🃏</div>
              <h3>Mode Dealer</h3>
              <p>Vous distribuez les cartes, gérez les mises et faites avancer la partie.</p>
              <div class="select-hint">CHEF DE TABLE</div>
            </div>
            
            <div class="role-card glass-card" (click)="join('spectator')">
              <div class="role-icon">👁️</div>
              <h3>Mode Spectateur</h3>
              <p>Vous observez la partie sans pouvoir agir. Idéal pour suivre le jeu en direct.</p>
              <div class="select-hint">OBSERVATEUR</div>
            </div>
          </div>
          
          <button class="back-btn" (click)="selectedGameId = null">
            ← Retour à la liste
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .join-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 120px);
      padding: 20px;
    }
    .list-card {
      width: 100%;
      max-width: 600px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      position: relative;
    }
    .subtitle {
      color: var(--text-secondary);
      margin-top: -12px;
    }
    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 0;
      gap: 16px;
      color: var(--text-secondary);
    }
    .empty-icon {
      font-size: 3rem;
      opacity: 0.5;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: var(--accent-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .game-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .game-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background: rgba(255, 255, 255, 0.03);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .game-item:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: scale(1.02);
      border-color: var(--accent-primary);
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .game-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .room-id {
      font-weight: 900;
      font-size: 1.2rem;
      letter-spacing: 0.05em;
      color: var(--text-primary);
    }
    .status-badge {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(255,255,255,0.1);
      color: var(--text-secondary);
    }
    .status-badge.in-progress {
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent-primary);
    }
    .game-details {
      display: flex;
      gap: 16px;
    }
    .detail {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .icon { font-size: 0.9rem; }
    .value { font-weight: 600; }
    
    .join-arrow {
      font-size: 1.2rem;
      color: var(--accent-primary);
      opacity: 0;
      transform: translateX(-10px);
      transition: all 0.3s ease;
    }
    .game-item:hover .join-arrow {
      opacity: 1;
      transform: translateX(0);
    }

    .refresh-btn {
      background: var(--glass);
      border: 1px solid var(--card-border);
      color: var(--text-primary);
      padding: 10px 20px;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 auto;
    }
    .refresh-btn:hover {
      background: rgba(255,255,255,0.1);
    }
    .refresh-btn.fab {
      position: absolute;
      top: 40px;
      right: 40px;
      padding: 10px;
      border-radius: 50%;
      width: 44px;
      height: 44px;
      justify-content: center;
      margin: 0;
    }

    /* Role Selection styles */
    .role-selection { display: flex; flex-direction: column; gap: 24px; animation: slideUp 0.3s ease; }
    .role-options { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .role-card {
      padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: 12px; cursor: pointer; transition: all 0.3s; border: 1px solid rgba(255,255,255,0.05);
    }
    .role-card:hover { border-color: var(--accent-primary); background: rgba(255, 255, 255, 0.08); transform: translateY(-5px); }
    .role-icon { font-size: 2.5rem; }
    .role-card h3 { font-size: 1.1rem; color: var(--text-primary); }
    .role-card p { font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; }
    .select-hint { font-size: 0.65rem; font-weight: 800; letter-spacing: 0.1em; color: var(--accent-primary); margin-top: auto; padding-top: 10px; }
    .back-btn { background: transparent; color: var(--text-secondary); border: none; padding: 5px; font-size: 0.9rem; cursor: pointer; border-radius: 0; }
    .back-btn:hover { color: var(--text-primary); }

    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 600px) {
      .list-card { padding: 24px; }
      .game-details { flex-direction: column; gap: 4px; }
      .refresh-btn.fab { top: 24px; right: 24px; }
      .role-options { grid-template-columns: 1fr; }
    }
  `]
})
export class JoinGameComponent implements OnInit {
  private pokerService = inject(PokerService);
  private router = inject(Router);

  games: { id: string, state: GameState }[] = [];
  loading = true;
  selectedGameId: string | null = null;

  ngOnInit() {
    this.refresh();
  }

  async refresh() {
    this.loading = true;
    try {
      this.games = await this.pokerService.getActiveGames();
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      this.loading = false;
    }
  }

  selectGame(gameId: string) {
    this.selectedGameId = gameId;
  }

  join(role: 'dealer' | 'spectator') {
    if (!this.selectedGameId) return;
    this.pokerService.setRole(role);
    this.pokerService.enableSync(this.selectedGameId);
    this.router.navigate(['/game']);
  }
}
