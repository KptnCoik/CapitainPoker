import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokerService } from '../../services/poker.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.css'
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

    // Enable sync with this ID and push initial state
    await this.pokerService.enableSync(roomId, true);

    this.router.navigate(['/game'], { queryParams: { room: roomId } });
  }

  async joinRoom() {
    if (!this.joinRoomId) return;

    const roomId = this.joinRoomId.toUpperCase().trim();
    await this.pokerService.enableSync(roomId);

    this.router.navigate(['/game'], { queryParams: { room: roomId } });
  }
}
