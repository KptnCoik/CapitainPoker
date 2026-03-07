import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerService } from '../../services/poker.service';
import { Observable } from 'rxjs';
import { GameState, HandReplay, Card } from '../../models/poker.model';

@Component({
  selector: 'app-replay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './replay.component.html',
  styleUrl: './replay.component.css'
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
