import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokerService } from '../../services/poker.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="setup-container">
      <div class="glass-card setup-card">
        <h1 class="text-gradient">Capitaine Poker</h1>
        <p class="subtitle">Entrez les infos pour commencer la partie</p>

        <div class="form-group">
          <label>Tapis de départ</label>
          <div class="input-with-hint">
            <input type="number" [(ngModel)]="initialChips" placeholder="1000">
            <span class="bb-hint" *ngIf="bigBlind > 0">{{ initialChips / bigBlind | number:'1.0-1' }} BB</span>
          </div>
        </div>

        <div class="form-group">
          <label>Blinds (SB / BB)</label>
          <div class="blind-inputs">
            <input type="number" [(ngModel)]="smallBlind" placeholder="SB">
            <span>/</span>
            <input type="number" [(ngModel)]="bigBlind" placeholder="BB">
          </div>
        </div>

        <div class="player-list">
          <div class="list-header">
            <h3>Joueurs</h3>
            <span class="player-count badge">{{ playerNames.length }}</span>
          </div>
          <div *ngFor="let name of playerNames; let i = index; trackBy: trackByIndex" class="player-input-row"
               draggable="true" 
               (dragstart)="onDragStart(i)" 
               (dragover)="onDragOver($event)" 
               (drop)="onDrop(i)"
               [class.dragging]="draggingIndex === i">
            <span class="player-number">{{ i + 1 }}</span>
            <input type="text" [(ngModel)]="playerNames[i]" placeholder="Nom du joueur">
            <div class="drag-handle">⋮⋮</div>
            <button (click)="removePlayer(i)" class="remove-btn" [disabled]="playerNames.length <= 2">×</button>
          </div>
          <button (click)="addPlayerInput()" class="add-player-btn">+ Ajouter un joueur</button>
          <p class="drag-hint">💡 Astuce : Faites glisser les joueurs pour les réorganiser à la table.</p>
        </div>

        <div class="form-group dealer-select">
          <label>Premier Dealer</label>
          <select [(ngModel)]="dealerIndex">
            <option *ngFor="let name of playerNames; let i = index" [value]="i">
              {{ name || 'Joueur ' + (i + 1) }}
            </option>
          </select>
        </div>

        <div class="multiplayer-box">
          <label>Options Multi-joueurs</label>
          <div class="multi-actions">
            <div class="join-group">
              <input type="text" [(ngModel)]="joinRoomId" placeholder="ID de la salle">
              <button (click)="joinRoom()" [disabled]="!joinRoomId" class="join-btn">Rejoindre</button>
            </div>
            <p class="or-separator">OU</p>
            <button (click)="startMultiplayer()" class="host-btn" [disabled]="!isSetupValid()">
               Créer une salle partagée
            </button>
          </div>
        </div>

        <button (click)="startGame()" class="start-btn" [disabled]="!isSetupValid()">
          Commencer Localement
        </button>
      </div>
    </div>
  `,
  styles: [`
    .setup-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 80px);
      padding: 20px;
    }
    .setup-card {
      width: 100%;
      max-width: 500px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .subtitle {
      color: var(--text-secondary);
      margin-top: -12px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .blind-inputs {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .blind-inputs input { width: 100%; }
    .input-with-hint {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-with-hint input { width: 100%; }
    .bb-hint {
      position: absolute;
      right: 12px;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--accent-primary);
      background: rgba(0,0,0,0.3);
      padding: 2px 8px;
      border-radius: 6px;
      pointer-events: none;
    }
    .player-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .player-count {
      background: var(--accent-primary);
      color: #000;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 10px;
      font-size: 0.8rem;
    }
    .player-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.03);
      padding: 4px 8px;
      border-radius: 12px;
      border: 1px solid transparent;
      transition: var(--transition);
    }
    .player-input-row.dragging {
      opacity: 0.5;
      border: 1px dashed var(--accent-primary);
    }
    .player-number {
      font-weight: 800;
      color: var(--accent-primary);
      width: 24px;
      text-align: center;
      font-size: 0.9rem;
    }
    .player-input-row input { flex: 1; border-color: transparent; background: transparent; }
    .player-input-row input:focus { border-color: var(--accent-primary); background: rgba(0,0,0,0.2); }
    
    .drag-handle {
      cursor: grab;
      color: var(--text-secondary);
      padding: 0 4px;
      font-size: 1.2rem;
      user-select: none;
    }
    .remove-btn {
      background: rgba(239, 68, 68, 0.1);
      color: var(--danger);
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .add-player-btn {
      background: var(--glass);
      border: 1px dashed var(--card-border);
      color: var(--accent-primary);
      margin-top: 4px;
    }
    .drag-hint {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-align: center;
      margin-top: 4px;
    }
    .start-btn {
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      padding: 16px;
      font-size: 1.1rem;
      margin-top: 12px;
      box-shadow: 0 4px 20px rgba(56, 189, 248, 0.3);
    }
    .start-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .multiplayer-box {
      border-top: 1px solid var(--card-border);
      padding-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .multi-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .join-group {
      display: flex;
      gap: 8px;
    }
    .join-group input { flex: 1; text-transform: uppercase; }
    .join-btn { background: var(--glass); white-space: nowrap; }
    .or-separator {
      text-align: center;
      font-size: 0.7rem;
      color: var(--text-secondary);
      font-weight: 800;
      margin: 4px 0;
    }
    .host-btn {
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid var(--accent-primary);
      color: var(--accent-primary);
    }
    .host-btn:hover:not(:disabled) {
      background: var(--accent-primary);
      color: #000;
    }

    /* RESPONSIVE SETUP */
    @media (max-width: 768px) {
      .setup-container {
        padding: 10px;
        align-items: flex-start;
      }
      .setup-card {
        padding: 24px;
        border-radius: 16px;
        gap: 20px;
      }
      h1 { font-size: 1.8rem; }
      .player-input-row {
        padding: 4px;
      }
      .blind-inputs input, .input-with-hint input {
        padding: 10px;
      }
    }

    @media (max-width: 480px) {
      .setup-card {
        padding: 20px 15px;
        gap: 16px;
      }
      .subtitle {
        font-size: 0.9rem;
      }
      .player-input-row input {
        font-size: 0.9rem;
      }
    }
  `]
})
export class SetupComponent {
  playerNames: string[] = ['', '', ''];
  initialChips: number = 1000;
  smallBlind: number = 5;
  bigBlind: number = 10;
  dealerIndex: number = 0;
  draggingIndex: number | null = null;
  joinRoomId: string = '';

  constructor(private pokerService: PokerService, private router: Router) { }

  addPlayerInput() {
    this.playerNames.push('');
  }

  removePlayer(index: number) {
    this.playerNames.splice(index, 1);
    if (this.dealerIndex >= this.playerNames.length) {
      this.dealerIndex = 0;
    }
  }

  trackByIndex(index: number, item: any) {
    return index;
  }

  onDragStart(index: number) {
    this.draggingIndex = index;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(dropIndex: number) {
    if (this.draggingIndex !== null && this.draggingIndex !== dropIndex) {
      const draggedPlayer = this.playerNames[this.draggingIndex];
      this.playerNames.splice(this.draggingIndex, 1);
      this.playerNames.splice(dropIndex, 0, draggedPlayer);

      // Keep dealer index updated if player moves
      if (this.dealerIndex === this.draggingIndex) {
        this.dealerIndex = dropIndex;
      } else if (this.draggingIndex < this.dealerIndex && dropIndex >= this.dealerIndex) {
        this.dealerIndex--;
      } else if (this.draggingIndex > this.dealerIndex && dropIndex <= this.dealerIndex) {
        this.dealerIndex++;
      }
    }
    this.draggingIndex = null;
  }

  isSetupValid() {
    return this.playerNames.every(n => n.trim().length > 0) &&
      this.initialChips > 0 &&
      this.smallBlind > 0 &&
      this.bigBlind > 0;
  }

  startGame() {
    this.pokerService.disableSync();
    this.pokerService.setupGame(
      this.playerNames,
      this.initialChips,
      this.smallBlind,
      this.bigBlind,
      Number(this.dealerIndex)
    );
    this.router.navigate(['/game']);
  }

  async startMultiplayer() {
    if (!this.isSetupValid()) return;

    // Generate a random room ID
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Setup game state
    this.pokerService.setupGame(
      this.playerNames,
      this.initialChips,
      this.smallBlind,
      this.bigBlind,
      Number(this.dealerIndex)
    );

    // Enable sync with this ID
    await this.pokerService.enableSync(roomId);

    this.router.navigate(['/game'], { queryParams: { room: roomId } });
  }

  async joinRoom() {
    if (!this.joinRoomId) return;

    const roomId = this.joinRoomId.toUpperCase().trim();
    await this.pokerService.enableSync(roomId);

    this.router.navigate(['/game'], { queryParams: { room: roomId } });
  }
}
