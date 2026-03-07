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
  templateUrl: './info.component.html',
  styleUrl: './info.component.css'
})
export class InfoComponent {
  game$: Observable<GameState>;
  displayMode: 'cards' | 'ranking' = 'ranking';
  unitMode: 'chips' | 'bb' = 'chips';

  constructor(private pokerService: PokerService, private router: Router) {
    this.game$ = this.pokerService.game$;
  }

  get role(): 'dealer' | 'spectator' {
    return this.pokerService.currentRole;
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
      // If both are eliminated, sort by finishPosition (1 is winner, 8 is first out)
      if (a.finishPosition && b.finishPosition) {
        return a.finishPosition - b.finishPosition;
      }
      // If one is eliminated, active players always come first
      if (a.finishPosition) return 1;
      if (b.finishPosition) return -1;

      // If both are active, sort by chip count
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
}
