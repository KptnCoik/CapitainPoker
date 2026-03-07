import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokerService } from '../../services/poker.service';
import { GameState } from '../../models/poker.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-join-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './join-game.component.html',
  styleUrl: './join-game.component.css'
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
    this.router.navigate(['/game'], { queryParams: { room: this.selectedGameId } });
  }
}
