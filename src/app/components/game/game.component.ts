import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokerService } from '../../services/poker.service';
import { Player, GameState, Card, HandReplay } from '../../models/poker.model';
import { Observable } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit, OnDestroy {
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
  roomId: string | null = null;
  role: 'dealer' | 'spectator' = 'dealer';
  gameTimeDisplay = '00:00:00';
  private timerInterval: any;

  constructor(private pokerService: PokerService, private route: ActivatedRoute) {
    this.game$ = this.pokerService.game$;
  }

  currentWinnerId: string | undefined;

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  startTimer(startTime: number) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      this.gameTimeDisplay = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
      ].join(':');
    }, 1000);
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['room']) {
        this.roomId = params['room'];
        this.pokerService.enableSync(this.roomId!);
      }
    });

    this.game$.subscribe(state => {
      this.role = this.pokerService.currentRole;
      if (state.startTime && !this.timerInterval) {
        this.startTimer(state.startTime);
      }
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
    const isMobile = window.innerWidth < 768;
    const isSpectator = this.role === 'spectator';
    const angle = (index / total) * 2 * Math.PI - (Math.PI / 2);

    // Higher radiusX, tighter radiusY to avoid bottom/top clipping on mobile
    let radiusX = isMobile ? (window.innerWidth * 0.42) : 450;
    let radiusY = isMobile ? (window.innerHeight * 0.28) : 220;

    // Increase radii for spectators on desktop
    if (!isMobile && isSpectator) {
      radiusX = 580;
      radiusY = 280;
    }

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
