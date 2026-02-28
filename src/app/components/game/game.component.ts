import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokerService } from '../../services/poker.service';
import { Player, GameState, Card, HandReplay } from '../../models/poker.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="game$ | async as state" class="game-container" [class.animating-chips]="isAnimatingChips">
      <div class="top-bar">
        <div class="blind-info glass-card">
          Blinds: <span class="text-gradient">{{ state.smallBlind }} / {{ state.bigBlind }}</span>
          <button (click)="openBlindsModal(state.smallBlind, state.bigBlind)" class="edit-blinds-btn" title="Augmenter les Blinds">✎</button>
        </div>
        <div class="display-toggle glass-card">
          <label>Affichage:</label>
          <div class="toggle-btns">
            <button [class.active]="viewMode === 'chips'" (click)="viewMode = 'chips'">Chips</button>
            <button [class.active]="viewMode === 'bb'" (click)="viewMode = 'bb'">BB</button>
          </div>
        </div>
      </div>

      <div class="table-area">
        <div class="poker-table glass-card">
          <div class="pot-area">
            <div class="pot-display" [class.dimmed]="state.isHandOver">
              <span class="pot-label text-gradient">{{ state.isHandOver ? 'DERNIER POT' : 'POT' }}</span>
              <span class="pot-value" [innerHTML]="formatValue(state.pot, state.bigBlind)"></span>
            </div>
            
            <div *ngIf="state.isHandOver" class="hand-over-overlay">
              <h2 class="text-gradient">Main Terminée</h2>
              <div class="hand-over-btns">
                <button (click)="startNextHand()" 
                        class="btn-next big-btn" 
                        [disabled]="hasBankruptPlayers(state)">
                  Main Suivante
                </button>
                <button (click)="startSavingReplay(state)" class="btn-secondary" style="margin-top: 10px;">
                  Enregistrer la main 📁
                </button>
              </div>
              <p *ngIf="hasBankruptPlayers(state)" class="rebuy-hint">Veuillez gérer les joueurs sans jetons avant de continuer.</p>
            </div>

            <div class="community-cards" *ngIf="!state.isHandOver && state.currentPhase !== 'pre-flop'">
              <div class="cards-track">
                <div class="poker-card flop" *ngFor="let i of [0,1,2]" [style.animation-delay]="i * 0.1 + 's'">
                  <div class="card-inner glass-card">🂠</div>
                </div>
                <div class="poker-card turn" *ngIf="['turn', 'river', 'showdown'].includes(state.currentPhase)" [style.animation-delay]="'0s'">
                  <div class="card-inner glass-card">🂠</div>
                </div>
                <div class="poker-card river" *ngIf="['river', 'showdown'].includes(state.currentPhase)" [style.animation-delay]="'0s'">
                  <div class="card-inner glass-card">🂠</div>
                </div>
              </div>
              <div class="phase-label text-gradient">{{ state.currentPhase.toUpperCase() }}</div>
            </div>
          </div>

          <div *ngFor="let p of state.players; let i = index" 
               class="player-seat"
               [style.transform]="getSeatTransform(i, state.players.length)"
               [class.active-turn]="!state.isHandOver && state.currentPlayerIndex === i"
               [class.folded]="p.isFolded"
               [class.eliminated]="p.isEliminated"
               [class.is-winner]="isWinner(p.id)">

            <div class="player-info glass-card">
              <div class="player-cards" *ngIf="!p.isFolded && !p.isEliminated">
                <div class="mini-card glass-card">🂠</div>
                <div class="mini-card glass-card">🂠</div>
              </div>
              <span class="player-name">{{ p.name }}</span>
              <span class="player-chips" [class.danger-text]="p.chips === 0 && !p.isEliminated" [innerHTML]="formatValue(p.chips, state.bigBlind)">
              </span>
              
              <div class="badges">
                <span *ngIf="p.isDealer" class="badge dealer">D</span>
                <span *ngIf="p.isSmallBlind" class="badge sb">SB</span>
                <span *ngIf="p.isBigBlind" class="badge bb">BB</span>
              </div>

              <div *ngIf="p.currentBet > 0 && !state.isHandOver" class="current-bet" [innerHTML]="formatValue(p.currentBet, state.bigBlind)">
              </div>

              <div *ngIf="p.lastAction" class="action-bubble" [class]="p.lastAction.toLowerCase()">
                {{ p.lastAction }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="controls-area glass-card" *ngIf="!state.isHandOver">
        <div class="player-label">
          <ng-container *ngIf="state.currentPhase !== 'showdown'; else showdownLabel">
            Tour de : <span class="text-gradient">{{ getCurrentPlayer(state)?.name }}</span>
          </ng-container>
          <ng-template #showdownLabel>
            <span class="text-gradient">Abattage</span>
          </ng-template>
        </div>
        
        <div class="action-buttons">
          <button (click)="fold()" class="btn-fold" [disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">Fold</button>
          <button (click)="check()" class="btn-check" [disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">Check / Call</button>
          <div class="raise-container" [class.disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">
            <div class="stepper-group">
              <button (click)="adjustRaise(-state.bigBlind, state.minRaise)" 
                      class="btn-step" 
                      [disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">−</button>
              
              <div class="raise-mount-display">
                <input type="number" 
                       [(ngModel)]="raiseAmount" 
                       [min]="state.minRaise" 
                       [disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">
              </div>

              <button (click)="adjustRaise(state.bigBlind, state.minRaise)" 
                      class="btn-step" 
                      [disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">+</button>
            </div>
            <button (click)="raise()" 
                    class="btn-raise-action" 
                    [disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">
              RELANCER
            </button>
          </div>
          <button (click)="allIn()" class="btn-allin" [disabled]="state.currentPhase === 'showdown' || state.waitingForPhaseAdvancement">All-In</button>
        </div>

        <div class="round-management">
          <div *ngIf="state.currentPhase === 'showdown'" class="winner-selection">
            <span class="text-gradient">Qui a gagné le pot de <span [innerHTML]="formatValue(state.pot, state.bigBlind)"></span> ?</span>
            <div class="winner-btns">
              <button *ngFor="let p of getShowdownPlayers(state)" 
                      (click)="toggleWinner(p.id)"
                      [class.selected]="selectedWinners.includes(p.id)">
                {{ p.name }}
              </button>
            </div>
            
            <div *ngIf="lastWinners.length > 0 && state.pot > 0" class="previous-winners">
              <small>Gagnant(s) pot précédent : {{ getWinnerNames(state) }}</small>
            </div>

            <button (click)="resolveShowdown()" class="btn-success" [disabled]="selectedWinners.length === 0">Confirmer les gagnants</button>
          </div>
          <button (click)="advancePhaseWithAnimation()" 
                  class="btn-next" 
                  [class.flashing]="state.waitingForPhaseAdvancement"
                  [disabled]="!state.waitingForPhaseAdvancement"
                  *ngIf="state.currentPhase !== 'showdown'">
            {{ state.waitingForPhaseAdvancement ? 'DISTRIBUER' : 'Distribuer les cartes' }}
          </button>
          <button (click)="openAddPlayerModal(state.players.length)" class="btn-secondary">Ajouter un joueur</button>
        </div>
      </div>

      <!-- Simple Add Player Modal -->
      <div class="modal-overlay" *ngIf="showAddPlayerModal">
        <div class="glass-card modal">
          <h3>Ajouter un joueur</h3>
          <div class="input-field">
            <small>Nom</small>
            <input type="text" [(ngModel)]="newPlayerName" placeholder="Nom">
          </div>
          <div class="input-field">
            <small>Jetons</small>
            <input type="number" [(ngModel)]="newPlayerChips" placeholder="Jetons">
          </div>
          <div class="input-field">
            <small>Placer après :</small>
            <select [(ngModel)]="selectedPosition" *ngIf="game$ | async as state">
              <option [value]="0">Au début de la table</option>
              <option *ngFor="let p of state.players; let i = index" [value]="i + 1">
                Après {{ p.name }}
              </option>
            </select>
          </div>
          <div class="modal-buttons">
            <button (click)="addPlayerByModal()" class="btn-success">Ajouter</button>
            <button (click)="showAddPlayerModal = false" class="btn-fold">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Elimination / Rebuy Modal -->
      <div class="modal-overlay" *ngIf="state.isHandOver && getBankruptPlayer(state) as p">
        <div class="glass-card modal rebuy-modal">
          <h2 class="text-gradient">{{ p.name }} est kickout !</h2>
          <p>Voulez-vous recaver ou kickout ce joueur ?</p>
          <div class="modal-buttons vertical">
            <div class="rebuy-input-group">
              <input type="number" [(ngModel)]="rebuyAmount" placeholder="Montant">
              <button (click)="confirmRebuy(p.id)" class="btn-success">Recaver</button>
            </div>
            <button (click)="confirmElimination(p.id)" class="btn-fold">Kickout le joueur</button>
          </div>
        </div>
      </div>

      <!-- Blinds Update Modal -->
      <div class="modal-overlay" *ngIf="showBlindsModal">
        <div class="glass-card modal">
          <h3>Augmenter les Blinds</h3>
          <div class="rebuy-input-group" style="flex-direction: column; gap: 15px;">
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <small style="color: var(--text-secondary)">Petite Blind</small>
              <input type="number" [(ngModel)]="newSmallBlind">
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <small style="color: var(--text-secondary)">Grosse Blind</small>
              <input type="number" [(ngModel)]="newBigBlind">
            </div>
          </div>
          <div class="modal-buttons">
            <button (click)="confirmBlinds()" class="btn-success">Confirmer</button>
            <button (click)="showBlindsModal = false" class="btn-fold">Annuler</button>
          </div>
        </div>
      </div>
      <!-- Replay Saver Modal -->
      <div class="modal-overlay" *ngIf="isSavingReplay">
        <div class="glass-card modal card-saver-modal">
          <h2 class="text-gradient">Enregistrer le coup</h2>
          
          <div class="saver-section">
            <small>BOARD (Flop / Turn / River)</small>
            <div class="cards-setup-row">
              <div *ngFor="let i of [0,1,2,3,4]" class="card-slot" (click)="openPicker('board', i)">
                <div *ngIf="editingReplayBoard[i]" class="poker-card-real" [ngClass]="'suit-' + editingReplayBoard[i].suit">
                  <span class="rank">{{ editingReplayBoard[i].rank }}</span>
                  <span class="suit-icon">{{ getSuitChar(editingReplayBoard[i].suit) }}</span>
                </div>
                <div *ngIf="!editingReplayBoard[i]" class="card-placeholder">+</div>
              </div>
            </div>
          </div>

          <div class="saver-players">
             <div *ngFor="let p of editingReplayPlayers" class="player-card-setup">
               <div class="p-setup-header">
                 <span class="p-setup-name" [class.is-winner]="p.isWinner">{{ p.name }}</span>
                 <div class="p-status-badges">
                   <span class="status-badge allin" *ngIf="p.isAllIn">ALL-IN</span>
                   <span class="status-badge eliminated" *ngIf="p.isEliminated">KICKOUT</span>
                   <span class="status-badge rebought" *ngIf="p.isRebought">RECAVE</span>
                 </div>
               </div>
               <div class="cards-setup-row" *ngIf="!p.isFolded">
                 <div *ngFor="let i of [0,1]" class="card-slot" (click)="openPicker('player', i, p.id)">
                   <div *ngIf="p.holeCards[i]" class="poker-card-real mini" [ngClass]="'suit-' + p.holeCards[i].suit">
                     <span class="rank">{{ p.holeCards[i].rank }}</span>
                     <span class="suit-icon">{{ getSuitChar(p.holeCards[i].suit) }}</span>
                   </div>
                   <div *ngIf="!p.holeCards[i]" class="card-placeholder mini">+</div>
                 </div>
               </div>
               <div *ngIf="p.isFolded" class="folded-placeholder">
                 <span class="status-badge-mini folded">COUCHÉ</span>
               </div>
             </div>
          </div>

          <div class="modal-buttons">
            <button (click)="confirmSaveReplay(state)" class="btn-success">Sauvegarder l'Action</button>
            <button (click)="isSavingReplay = false" class="btn-fold">Annuler</button>
          </div>
        </div>
      </div>

      <!-- Card Picker Sub-Modal -->
      <div class="modal-overlay sub-modal" *ngIf="showCardPicker">
        <div class="glass-card modal picker-modal">
          <div class="picker-header">
            <h3 class="text-gradient">Selectionnez une Carte</h3>
            <p class="picker-subtitle">
              Pour : <strong class="text-accent">{{ getPickerTargetName() }}</strong>
            </p>
          </div>

          <div class="picker-body">
            <div *ngFor="let s of suits" class="picker-suit-row">
              <div class="suit-row-label" [ngClass]="'suit-' + s">{{ getSuitChar(s) }}</div>
              <div class="cards-suit-list">
                <div *ngFor="let r of ranks" 
                     class="selectable-card" 
                     [ngClass]="'suit-' + s"
                     [class.selected]="isCardSelected(r, s)"
                     (click)="selectCard(r, s)">
                  <span class="rank">{{ r }}</span>
                  <span class="suit-mini">{{ getSuitChar(s) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-buttons">
            <button (click)="showCardPicker = false" class="btn-fold">Fermer sans choisir</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .game-container {
      padding: 20px 40px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      height: calc(100vh - 100px);
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }
    .blind-info, .display-toggle {
      padding: 10px 20px;
      border-radius: 15px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
    }
    .edit-blinds-btn {
      background: rgba(255,255,255,0.1);
      border: 1px solid var(--card-border);
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.9rem;
      margin-left: 8px;
    }
    .edit-blinds-btn:hover { background: var(--accent-primary); color: #000; border-color: transparent; }

    .toggle-btns {
      display: flex;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      overflow: hidden;
    }
    .toggle-btns button {
      padding: 6px 12px;
      border-radius: 0;
      background: transparent;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
    .toggle-btns button.active {
      background: var(--accent-primary);
      color: #000;
    }

    .table-area {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .poker-table {
      width: 1000px;
      height: 500px;
      border-radius: 250px;
      position: relative;
      background: radial-gradient(ellipse at center, #1e3a8a, #0f172a);
      border: 10px solid var(--card-border);
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .pot-area {
      text-align: center;
      z-index: 10;
      position: absolute;
      width: 100%; height: 100%;
      top: 0; left: 0;
      display: flex; justify-content: center; align-items: center;
    }
    .pot-display { 
      position: absolute;
      top: 28%;
      display: flex; flex-direction: column; gap: 0;
    }
    .pot-label { font-size: 0.7rem; font-weight: 900; opacity: 0.8; letter-spacing: 0.1em; }
    .pot-value { font-size: 1.8rem; font-weight: 800; transition: var(--transition); }
    .dimmed { opacity: 0.3; filter: blur(2px); }

    .community-cards {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .cards-track { display: flex; gap: 6px; }
    .poker-card {
      width: 36px;
      height: 52px;
      animation: cardPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
    }
    .card-inner {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; border-radius: 6px;
      color: var(--accent-primary);
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    }
    .phase-label { font-size: 0.7rem; font-weight: 900; letter-spacing: 0.3em; opacity: 0.6; }

    .hand-over-overlay {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      display: flex; flex-direction: column; align-items: center; gap: 20px;
      z-index: 20;
    }
    .big-btn { font-size: 1.2rem; padding: 16px 32px; box-shadow: 0 0 30px rgba(56, 189, 248, 0.4); }
    .rebuy-hint {
      color: var(--warning);
      font-size: 0.9rem;
      font-weight: 600;
      margin-top: 10px;
      animation: pulse 2s infinite;
    }

    .player-seat { position: absolute; width: 140px; text-align: center; transition: var(--transition); }
    .player-info { padding: 16px; border-radius: 20px; display: flex; flex-direction: column; gap: 4px; position: relative; }
    .active-turn .player-info {
      background: rgba(56, 189, 248, 0.15);
      border-color: var(--accent-primary);
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.5);
      transform: scale(1.1);
    }
    .is-winner .player-info {
      border-color: var(--success);
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.6);
      animation: bounce 1s infinite;
    }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

    .folded { opacity: 0.4; filter: grayscale(1); }
    .eliminated { opacity: 0.2; filter: grayscale(1); pointer-events: none; }
    .player-name { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1.1rem; }
    .player-chips { font-size: 0.9rem; color: var(--accent-primary); font-weight: 600; }
    .danger-text { color: var(--danger); animation: pulse 1s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    
    .badges { position: absolute; top: -12px; right: -12px; display: flex; gap: 4px; }
    .badge {
      width: 28px; height: 28px; border-radius: 50%;
      font-size: 0.7rem; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
      color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .dealer { background: #facc15; border: 2px solid white; color: #000; }
    .sb { background: var(--accent-secondary); }
    .bb { background: var(--danger); }

    .current-bet {
      position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%);
      background: var(--accent-primary); color: #000;
      padding: 4px 14px; border-radius: 20px;
      font-weight: 800; font-size: 0.85rem;
      z-index: 10;
    }

    .player-cards {
      position: absolute;
      top: -45px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 4px;
      z-index: 15;
    }
    .mini-card {
      width: 30px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      border-radius: 6px;
      background: rgba(255,255,255,0.1) !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
      color: var(--accent-primary);
    }

    .action-bubble {
      position: absolute; top: -85px; left: 50%; transform: translateX(-50%);
      padding: 4px 12px; border-radius: 8px;
      font-size: 0.75rem; font-weight: 900;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.1);
      animation: slideDown 0.3s ease-out;
      color: white;
      z-index: 20;
    }
    .action-bubble.check { background: rgba(16, 185, 129, 0.4); border-color: var(--success); }
    .action-bubble.raise { background: rgba(56, 189, 248, 0.4); border-color: var(--accent-primary); }
    .action-bubble.all-in { background: rgba(244, 63, 94, 0.4); border-color: var(--danger); }
    .action-bubble.fold { background: rgba(0,0,0,0.5); border-color: #666; }
    .action-bubble.winner { background: var(--success); color: #000; box-shadow: 0 0 15px var(--success); }

    @keyframes slideDown {
      from { opacity: 0; transform: translate(-50%, -10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    @keyframes cardPop {
      0% { opacity: 0; transform: translateY(20px) scale(0.5); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .controls-area { padding: 30px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
    .action-buttons { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    
    .raise-container {
      display: flex;
      align-items: center;
      background: rgba(0,0,0,0.4);
      padding: 6px;
      border-radius: 16px;
      border: 1px solid rgba(56, 189, 248, 0.3);
      gap: 8px;
      transition: var(--transition);
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
    }
    .raise-container:not(.disabled):hover {
      border-color: var(--accent-primary);
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.2), inset 0 2px 10px rgba(0,0,0,0.5);
    }
    .raise-container.disabled { opacity: 0.5; filter: grayscale(0.8); }

    .stepper-group {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px;
    }

    .btn-step {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-primary);
      font-size: 1.4rem;
      font-weight: 300;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      padding: 0;
      line-height: 1;
    }

    .btn-step:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
      transform: translateY(-2px);
    }

    .btn-step:active:not(:disabled) { transform: translateY(0); }

    .raise-mount-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 80px;
    }

    .currency-icon { font-size: 1rem; margin-bottom: -4px; filter: drop-shadow(0 0 5px rgba(250, 204, 21, 0.3)); }
    
    .raise-mount-display input {
      width: 70px;
      background: transparent;
      border: none;
      color: var(--accent-primary);
      font-weight: 900;
      font-size: 1.4rem;
      padding: 2px;
      text-align: center;
    }
    .raise-mount-display input:focus { outline: none; }
    /* Chrome, Safari, Edge, Opera */
    .raise-mount-display input::-webkit-outer-spin-button,
    .raise-mount-display input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .btn-raise-action {
      background: var(--accent-primary);
      color: white;
      font-weight: 800;
      font-size: 0.9rem;
      letter-spacing: 1px;
      padding: 10px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
      transition: var(--transition);
      border: none;
    }
    .btn-raise-action:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(56, 189, 248, 0.4);
    }
    .btn-raise-action:active:not(:disabled) { transform: translateY(0); }
    
    .round-management { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
    .winner-selection {
      display: flex; flex-direction: column; gap: 12px;
      background: rgba(255,255,255,0.05); padding: 20px; border-radius: 20px;
    }
    .winner-btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .winner-selection button.selected { background: var(--success); box-shadow: 0 0 15px var(--success); }

    .btn-fold { background: var(--danger); color: white; }
    .btn-check { background: var(--success); color: white; }
    .btn-raise { background: var(--accent-primary); color: white; }
    .btn-allin { background: var(--accent-secondary); color: white; }
    .btn-next { background: var(--text-primary); color: #000; }
    .btn-success { background: var(--success); color: white; }
    .btn-secondary { background: var(--glass); color: var(--text-primary); border: 1px solid var(--card-border); }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      filter: grayscale(0.8);
    }

    .btn-next.flashing {
      animation: pulse-flash 1.5s infinite;
      background: var(--accent-primary);
      color: #000;
      font-weight: 900;
      box-shadow: 0 0 20px var(--accent-primary);
    }
    @keyframes pulse-flash {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }

    .animating-chips .current-bet {
      transition: all 0.6s cubic-bezier(0.55, 0.055, 0.675, 0.19);
      bottom: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) scale(0) !important;
      opacity: 0;
    }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .modal { width: 450px; padding: 40px; display: flex; flex-direction: column; gap: 20px; }
    .rebuy-modal { border-color: var(--warning); text-align: center; }
    .vertical { flex-direction: column; }
    .rebuy-input-group { display: flex; gap: 10px; }
    .rebuy-input-group input { flex: 1; }
    .card-saver-modal { width: 600px; max-height: 90vh; overflow-y: auto; }
    .saver-section, .saver-players { margin: 15px 0; }
    .cards-setup-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px; }
    .card-slot { cursor: pointer; }
    .p-setup-name { font-weight: 700; font-size: 0.9rem; color: var(--text-secondary); }
    .p-setup-name.is-winner { color: var(--success); }
    .player-card-setup { padding: 10px; background: rgba(0,0,0,0.2); border-radius: 12px; margin-bottom: 8px; }
    .picker-modal { width: 650px; }
    .suit-grid { margin-bottom: 10px; }
    .sub-modal { z-index: 1100; }
    .card-placeholder.mini { width: 32px; height: 48px; }
    .hand-over-btns { display: flex; flex-direction: column; gap: 10px; width: 100%; align-items: center; }
    
    .p-setup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
    .p-status-badges { display: flex; gap: 4px; }
    .status-badge { font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-weight: 900; color: white; }
    .status-badge.allin { background: var(--accent-secondary); }
    .status-badge.eliminated { background: var(--danger); }
    .status-badge.rebought { background: var(--warning); color: #000; }
    .folded-placeholder { padding: 8px; font-style: italic; color: var(--text-secondary); font-size: 0.8rem; }
    .status-badge-mini.folded { background: #475569; color: white; opacity: 0.7; }
  `]
})
export class GameComponent implements OnInit {
  game$: Observable<GameState>;
  raiseAmount: number = 0;
  showAddPlayerModal = false;
  newPlayerName = '';
  newPlayerChips = 1000;
  selectedWinners: string[] = [];
  lastWinners: string[] = [];
  viewMode: 'chips' | 'bb' = 'chips';
  selectedPosition: number = 0;
  accumulatedPotForHistory = 0;

  // Blinds update
  showBlindsModal = false;
  newSmallBlind = 0;
  newBigBlind = 0;

  // Rebuy / Elimination
  rebuyAmount: number = 1000;
  lastProcessedPlayerId: string | null = null;
  isAnimatingChips = false;

  // Replay
  isSavingReplay = false;
  showCardPicker = false;
  editingReplayBoard: Card[] = [];
  editingReplayPlayers: {
    id: string,
    name: string,
    holeCards: Card[],
    winAmount: number,
    isWinner: boolean,
    isAllIn: boolean,
    isEliminated: boolean,
    isRebought: boolean,
    isFolded: boolean
  }[] = [];
  currentPickTarget: { type: 'board' | 'player', index: number, playerId?: string } | null = null;
  totalHandPot = 0;
  playersWhoReboughtInThisHand: string[] = [];

  ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  suits: ('H' | 'D' | 'C' | 'S')[] = ['H', 'D', 'C', 'S'];

  startSavingReplay(state: GameState) {
    this.isSavingReplay = true;
    this.editingReplayBoard = [];
    this.totalHandPot = this.accumulatedPotForHistory;
    this.editingReplayPlayers = state.players
      .filter(p => p.initialChipsForHand > 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        holeCards: [],
        winAmount: p.chips - p.initialChipsForHand,
        isWinner: p.lastAction === 'WINNER',
        isAllIn: p.isAllIn,
        isEliminated: p.isEliminated && !this.playersWhoReboughtInThisHand.includes(p.id),
        isRebought: this.playersWhoReboughtInThisHand.includes(p.id),
        isFolded: p.isFolded
      }));
  }

  openPicker(type: 'board' | 'player', index: number, playerId?: string) {
    this.currentPickTarget = { type, index, playerId };
    this.showCardPicker = true;
  }

  selectCard(rank: string, suit: 'H' | 'D' | 'C' | 'S') {
    if (!this.currentPickTarget) return;

    const card: Card = { rank, suit };
    if (this.currentPickTarget.type === 'board') {
      this.editingReplayBoard[this.currentPickTarget.index] = card;
    } else if (this.currentPickTarget.type === 'player') {
      const p = this.editingReplayPlayers.find(pl => pl.id === this.currentPickTarget?.playerId);
      if (p) p.holeCards[this.currentPickTarget.index] = card;
    }
    this.showCardPicker = false;
    this.currentPickTarget = null;
  }

  isCardSelected(rank: string, suit: string): boolean {
    const isBoard = this.editingReplayBoard.some(c => c?.rank === rank && c?.suit === suit);
    const isPlayer = this.editingReplayPlayers.some(p => p.holeCards.some(c => c?.rank === rank && c?.suit === suit));
    return isBoard || isPlayer;
  }

  confirmSaveReplay(state: GameState) {
    const replay: HandReplay = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      players: this.editingReplayPlayers.map(p => ({
        id: p.id,
        name: p.name,
        holeCards: p.isFolded ? undefined : [p.holeCards[0], p.holeCards[1]],
        isWinner: p.isWinner,
        winAmount: p.winAmount,
        isAllIn: p.isAllIn,
        isEliminated: p.isEliminated,
        isRebought: p.isRebought
      })),
      communityCards: this.editingReplayBoard.filter(c => !!c),
      pot: this.totalHandPot,
      bigBlind: state.bigBlind,
      phase: state.currentPhase
    };
    this.pokerService.saveHandReplay(replay);
    this.isSavingReplay = false;
  }

  getPickerTargetName(): string {
    if (!this.currentPickTarget) return 'Emplacement';
    if (this.currentPickTarget.type === 'board') {
      const names = ['1ère carte Flop', '2ème carte Flop', '3ème carte Flop', 'Turn', 'River'];
      return names[this.currentPickTarget.index] || 'Board';
    } else {
      const p = this.editingReplayPlayers.find(pl => pl.id === this.currentPickTarget?.playerId);
      return `${p?.name || 'Joueur'} (Carte ${this.currentPickTarget.index + 1})`;
    }
  }

  getSuitChar(suit: string): string {
    const chars: Record<string, string> = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    return chars[suit] || '';
  }

  adjustRaise(delta: number, min: number) {
    this.raiseAmount = Math.max(min, this.raiseAmount + delta);
  }

  constructor(private pokerService: PokerService) {
    this.game$ = this.pokerService.game$;
  }

  currentWinnerId: string | undefined;

  ngOnInit() {
    this.game$.subscribe(state => {
      this.raiseAmount = state.minRaise;
      if (state.currentPhase === 'pre-flop' && state.pot > 0 && !state.isHandOver && state.history.length === 0) {
        // Hand just started
        this.accumulatedPotForHistory = state.pot;
      }
      if (state.isHandOver) {
        this.selectedWinners = [];
        const bankrupt = this.getBankruptPlayer(state);
        if (bankrupt && (!this.lastProcessedPlayerId || this.lastProcessedPlayerId !== bankrupt.id)) {
          this.rebuyAmount = bankrupt.initialChips;
          this.lastProcessedPlayerId = bankrupt.id;
        }
      } else {
        this.lastProcessedPlayerId = null;
      }
    });
  }

  hasBankruptPlayers(state: GameState): boolean {
    return state.players.some(p => p.chips === 0 && !p.isEliminated);
  }

  getBankruptPlayer(state: GameState): Player | undefined {
    return state.players.find(p => p.chips === 0 && !p.isEliminated);
  }

  formatValue(value: number, bigBlind: number): string {
    if (this.viewMode === 'bb') {
      return (value / bigBlind).toFixed(1) + ' BB';
    }
    return `<span><span class="poker-chip"></span>${value.toLocaleString()}</span>`;
  }

  getSeatTransform(index: number, total: number) {
    const angle = (index / total) * 2 * Math.PI - (Math.PI / 2);
    const radiusX = 450;
    const radiusY = 220;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    return `translate(${x}px, ${y}px)`;
  }

  getCurrentPlayer(state: GameState): Player | undefined {
    return state.players[state.currentPlayerIndex];
  }

  getShowdownPlayers(state: GameState): Player[] {
    // Only show players who contributed to the current part of the pot and haven't folded
    return state.players.filter(p => !p.isFolded && !p.isEliminated && p.handContribution > 0);
  }

  fold() {
    const state = this.pokerService.currentState;
    const p = this.getCurrentPlayer(state);
    if (p) this.pokerService.recordAction(p.id, 'fold', 0);
  }

  check() {
    const state = this.pokerService.currentState;
    const p = this.getCurrentPlayer(state);
    if (!p) return;

    const maxBet = Math.max(...state.players.map(pl => pl.currentBet));
    const callAmount = maxBet - p.currentBet;

    if (callAmount === 0) {
      this.pokerService.recordAction(p.id, 'check', 0);
    } else {
      this.pokerService.recordAction(p.id, 'call', callAmount);
    }
  }

  raise() {
    const state = this.pokerService.currentState;
    const p = this.getCurrentPlayer(state);
    if (!p) return;

    const maxBet = Math.max(...state.players.map(pl => pl.currentBet));
    const needed = (maxBet + this.raiseAmount) - p.currentBet;

    this.pokerService.recordAction(p.id, 'raise', needed);
  }

  allIn() {
    const state = this.pokerService.currentState;
    const p = this.getCurrentPlayer(state);
    if (p) this.pokerService.recordAction(p.id, 'all-in', p.chips);
  }

  advancePhaseWithAnimation() {
    this.isAnimatingChips = true;
    setTimeout(() => {
      this.pokerService.advancePhase();
      this.isAnimatingChips = false;
    }, 800);
  }

  advancePhase() {
    this.pokerService.advancePhase();
  }

  toggleWinner(id: string) {
    if (this.selectedWinners.includes(id)) {
      this.selectedWinners = this.selectedWinners.filter(wId => wId !== id);
    } else {
      this.selectedWinners.push(id);
    }
  }

  resolveShowdown() {
    if (this.selectedWinners.length > 0) {
      this.lastWinners = [...this.selectedWinners];
      this.currentWinnerId = this.selectedWinners[0];

      this.game$.subscribe(s => {
        if (s.currentPhase === 'showdown' && !s.isHandOver) {
          this.accumulatedPotForHistory += s.pot;
        }
      }).unsubscribe();

      this.pokerService.resolveHand(this.selectedWinners);
      this.selectedWinners = [];
    }
  }

  startNextHand() {
    this.lastWinners = [];
    this.playersWhoReboughtInThisHand = [];
    this.pokerService.advancePhase();
  }

  isWinner(id: string): boolean {
    return this.lastWinners.includes(id);
  }

  getWinnerNames(state: GameState): string {
    return state.players
      .filter(p => this.lastWinners.includes(p.id))
      .map(p => p.name)
      .join(', ');
  }

  openAddPlayerModal(currentTotal: number) {
    this.selectedPosition = currentTotal;
    this.showAddPlayerModal = true;
  }

  addPlayerByModal() {
    if (this.newPlayerName && this.newPlayerChips > 0) {
      this.pokerService.addPlayer(this.newPlayerName, this.newPlayerChips, Number(this.selectedPosition));
      this.showAddPlayerModal = false;
      this.newPlayerName = '';
    }
  }

  confirmRebuy(playerId: string) {
    if (this.rebuyAmount > 0) {
      if (!this.playersWhoReboughtInThisHand.includes(playerId)) {
        this.playersWhoReboughtInThisHand.push(playerId);
      }
      this.pokerService.rebuy(playerId, this.rebuyAmount);
      this.lastProcessedPlayerId = null;
    }
  }

  confirmElimination(playerId: string) {
    // Pass the current hand winner to track who made the elimination
    this.pokerService.eliminatePlayer(playerId, this.currentWinnerId);
    this.lastProcessedPlayerId = null;
  }

  openBlindsModal(sb: number, bb: number) {
    this.newSmallBlind = sb;
    this.newBigBlind = bb;
    this.showBlindsModal = true;
  }

  confirmBlinds() {
    if (this.newSmallBlind >= 0 && this.newBigBlind > 0) {
      this.pokerService.setBlinds(this.newSmallBlind, this.newBigBlind);
      this.showBlindsModal = false;
    }
  }
}
