import { Injectable, PLATFORM_ID, Inject, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { GameState, Player, PokerPhase, ActionRecord, PlayerStats, Card, HandReplay } from '../models/poker.model';
import { Firestore, doc, onSnapshot, setDoc, Timestamp, collection, getDocs } from '@angular/fire/firestore';

@Injectable({
    providedIn: 'root'
})
export class PokerService {
    private initialState: GameState = {
        players: [],
        dealerIndex: 0,
        smallBlind: 5,
        bigBlind: 10,
        pot: 0,
        currentPhase: 'pre-flop',
        currentPlayerIndex: 0,
        lastAggressorIndex: -1,
        minRaise: 0,
        history: [],
        savedHands: [],
        isHandOver: false,
        waitingForPhaseAdvancement: false
    };

    private gameSubject = new BehaviorSubject<GameState>(this.initialState);
    public game$ = this.gameSubject.asObservable();

    private firestore = inject(Firestore);
    private activeGameId: string | null = null;
    private userRole: 'dealer' | 'spectator' = 'dealer';
    private firestoreUnsubscribe: (() => void) | null = null;

    private updateState(newState: GameState) {
        this.gameSubject.next(newState);
        if (this.activeGameId && isPlatformBrowser(this.platformId)) {
            const gameRef = doc(this.firestore, `games/${this.activeGameId}`);
            setDoc(gameRef, this.serializeState(newState)).catch(err => {
                console.error('Failed to sync to Firebase:', err);
            });
        }
    }

    public async enableSync(gameId: string, forcePushInitialState = false) {
        if (this.firestoreUnsubscribe) {
            this.firestoreUnsubscribe();
        }

        // Clear local state ONLY if we are joining an existing room (not hosting/creating)
        // to avoid seeing data from a previous session while waiting for the snapshot.
        if (!forcePushInitialState && this.activeGameId !== gameId) {
            this.gameSubject.next({ ...this.initialState });
        }

        this.activeGameId = gameId;
        const gameRef = doc(this.firestore, `games/${gameId}`);

        if (forcePushInitialState) {
            await setDoc(gameRef, this.serializeState(this.gameSubject.value));
        }

        this.firestoreUnsubscribe = onSnapshot(gameRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                const remoteState = this.deserializeState(data as any);
                // Only update if state is different to avoid infinite loops
                // (simple comparison of JSON should work for this use case)
                if (JSON.stringify(remoteState) !== JSON.stringify(this.gameSubject.value)) {
                    this.gameSubject.next(remoteState);
                }
            }
        });
    }

    public disableSync() {
        if (this.firestoreUnsubscribe) {
            this.firestoreUnsubscribe();
            this.firestoreUnsubscribe = null;
        }
        this.activeGameId = null;
        this.userRole = 'dealer'; // Reset to default
    }

    public setRole(role: 'dealer' | 'spectator') {
        this.userRole = role;
    }

    public get currentRole(): 'dealer' | 'spectator' {
        return this.userRole;
    }

    private serializeState(state: GameState): any {
        // Deep clone and handle non-serializable objects (Dates in history & savedHands)
        return JSON.parse(JSON.stringify(state));
    }

    private deserializeState(data: any): GameState {
        // Here we could handle converting ISO strings back to Dates if needed,
        // but the app seems to work fine if we use them for display (or if we treat them as strings).
        // Let's ensure basic structure.
        return data as GameState;
    }

    public saveHandReplay(hand: HandReplay) {
        const state = this.currentState;
        const newSavedHands = [hand, ...state.savedHands];
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('poker_saved_hands', JSON.stringify(newSavedHands));
        }
        this.updateState({ ...state, savedHands: newSavedHands });
    }

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        if (isPlatformBrowser(this.platformId)) {
            const saved = localStorage.getItem('poker_saved_hands');
            if (saved) {
                try {
                    const savedHands = JSON.parse(saved);
                    // Update the simple BehaviorSubject with loaded data
                    // Note: We merging with initialState to ensure other required fields are present
                    this.updateState({ ...this.initialState, savedHands });
                } catch (e) {
                    console.error('Failed to load saved hands', e);
                }
            }
        }
    }

    public get currentState(): GameState {
        return this.gameSubject.value;
    }

    public setupGame(playerNames: string[], initialChips: number, smallBlind: number, bigBlind: number, dealerIndex: number) {
        this.disableSync(); // Ensure no previous game ID is active before setting up
        const players: Player[] = playerNames.map((name, index) => ({
            id: Math.random().toString(36).substring(2, 9),
            name,
            chips: initialChips,
            rebuyCount: 0,
            initialChips,
            isDealer: index === dealerIndex,
            isSmallBlind: false,
            isBigBlind: false,
            isFolded: false,
            isActive: true,
            isAllIn: false,
            isEliminated: false,
            position: index,
            currentBet: 0,
            handContribution: 0,
            initialChipsForHand: initialChips,
            needsToPostDeadBlind: false,
            lastAction: undefined,
            stats: this.createEmptyStats()
        }));

        this.updateState({
            ...this.initialState,
            players,
            dealerIndex,
            smallBlind,
            bigBlind,
            minRaise: bigBlind,
            isHandOver: false,
            currentPhase: 'pre-flop',
            startTime: Date.now()
        });

        this.moveDealer();
    }

    public addPlayer(name: string, chips: number, insertIndex?: number) {
        const state = this.currentState;
        const newPlayer: Player = {
            id: Math.random().toString(36).substring(2, 9),
            name,
            chips,
            rebuyCount: 0,
            initialChips: chips,
            isDealer: false,
            isSmallBlind: false,
            isBigBlind: false,
            isFolded: state.isHandOver ? false : true, // New player is folded if hand is in progress
            isActive: state.isHandOver ? true : false,
            isAllIn: false,
            isEliminated: false,
            position: insertIndex !== undefined ? insertIndex : state.players.length,
            currentBet: 0,
            handContribution: 0,
            initialChipsForHand: chips,
            needsToPostDeadBlind: true,
            lastAction: undefined,
            stats: this.createEmptyStats()
        };

        let players = [...state.players];
        let newDealerIndex = state.dealerIndex;
        let newCurrentPlayerIndex = state.currentPlayerIndex;
        let newLastAggressorIndex = state.lastAggressorIndex;

        const idx = insertIndex !== undefined ? insertIndex : players.length;
        players.splice(idx, 0, newPlayer);

        // Shift indices if we inserted before or at them
        if (idx <= state.dealerIndex) newDealerIndex++;
        if (idx <= state.currentPlayerIndex) newCurrentPlayerIndex++;
        if (idx <= state.lastAggressorIndex && state.lastAggressorIndex !== -1) newLastAggressorIndex++;

        // Update positions for all players
        players = players.map((p, i) => ({ ...p, position: i }));

        this.updateState({
            ...state,
            players,
            dealerIndex: newDealerIndex,
            currentPlayerIndex: newCurrentPlayerIndex,
            lastAggressorIndex: newLastAggressorIndex
        });
    }

    public rebuy(playerId: string, amount: number) {
        const state = this.currentState;
        const players = state.players.map(p => {
            if (p.id === playerId) {
                return {
                    ...p,
                    chips: p.chips + amount,
                    rebuyCount: p.rebuyCount + 1,
                    isEliminated: false,
                    isFolded: false,
                    isActive: true,
                    lastAction: undefined
                };
            }
            return p;
        });
        this.updateState({ ...state, players });
    }

    public eliminatePlayer(playerId: string, eliminatedBy?: string) {
        const state = this.currentState;
        const players = state.players.map(p => {
            if (p.id === playerId) {
                return {
                    ...p,
                    isEliminated: true,
                    isActive: false,
                    isFolded: true,
                    lastAction: 'OUT'
                };
            }
            if (eliminatedBy && p.id === eliminatedBy) {
                return {
                    ...p,
                    stats: { ...p.stats, eliminations: p.stats.eliminations + 1 }
                };
            }
            return p;
        });
        this.updateState({ ...state, players });
    }

    public recordAction(playerId: string, actionType: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount: number = 0) {
        const state = this.currentState;
        if (state.isHandOver) return;

        const playerIndex = state.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        const player = state.players[playerIndex];

        const actualAmount = Math.min(amount, player.chips);
        const isActuallyAllIn = actualAmount === player.chips || actionType === 'all-in';

        const updatedStats = { ...player.stats };
        if (actionType === 'fold') {
            if (state.currentPhase === 'pre-flop') updatedStats.preFlopFolds++;
            else if (state.currentPhase === 'flop') updatedStats.flopFolds++;
            else if (state.currentPhase === 'turn') updatedStats.turnFolds++;
            else if (state.currentPhase === 'river') updatedStats.riverFolds++;
        } else if (actionType === 'raise') {
            updatedStats.raises++;

            // Advanced Stats for Pre-flop
            if (state.currentPhase === 'pre-flop') {
                const maxBetBefore = Math.max(...state.players.map(p => p.currentBet));
                const bigBlind = state.bigBlind;

                // If the max bet before this action was just the Big Blind (or less), this is an OPEN
                if (maxBetBefore <= bigBlind) {
                    updatedStats.handsOpened++;
                } else {
                    // If someone already raised above the Big Blind, this is a 3Bet (or higher)
                    updatedStats.threeBets++;
                }

                // If they haven't put money in yet (currentBet is 0 or blinds), count as VPIP
                // For simplicity, we check if they just called/raised and it's their first action pre-flop
                // Actually, VPIP is just "did they voluntarily contribute?". 
                // We'll increment if this record doesn't show they already did.
            }
        } else if (isActuallyAllIn) {
            updatedStats.allIns++;
        }

        // VPIP Tracking (Pre-flop call/raise)
        if (state.currentPhase === 'pre-flop' && (actionType === 'call' || actionType === 'raise' || actionType === 'all-in')) {
            // Only count if it's their first voluntary action of the hand
            // (We check if they already have an action in the history for this hand that wasn't a blind)
            const alreadyPaid = state.history.some(h =>
                h.playerId === playerId &&
                h.phase === 'pre-flop' &&
                (h.action === 'call' || h.action === 'raise' || h.action === 'all-in')
            );
            if (!alreadyPaid) {
                updatedStats.voluntarilyPlayed++;
            }
        }

        const updatedPlayers = state.players.map((p, idx) => {
            if (idx === playerIndex) {
                const remainingChips = Math.max(0, p.chips - actualAmount);
                return {
                    ...p,
                    chips: remainingChips,
                    currentBet: p.currentBet + actualAmount,
                    handContribution: p.handContribution + actualAmount,
                    isFolded: actionType === 'fold',
                    isAllIn: isActuallyAllIn,
                    lastAction: actionType.toUpperCase(),
                    stats: updatedStats
                };
            }
            return p;
        });

        const newAction: ActionRecord = {
            playerId,
            playerName: player.name,
            action: isActuallyAllIn ? 'all-in' : actionType,
            amount: actualAmount,
            phase: state.currentPhase,
            timestamp: new Date()
        };

        let newLastAggressor = state.lastAggressorIndex;
        if (actionType === 'raise' || (actionType === 'all-in' && updatedPlayers[playerIndex].currentBet > Math.max(...state.players.map(p => p.currentBet)))) {
            newLastAggressor = playerIndex;
        }

        this.updateState({
            ...state,
            players: updatedPlayers,
            pot: state.pot + actualAmount,
            history: [...state.history, newAction],
            lastAggressorIndex: newLastAggressor
        });

        const activePlayers = updatedPlayers.filter(p => !p.isFolded && !p.isEliminated);
        if (activePlayers.length === 1) {
            this.resolveHand([activePlayers[0].id]);
        } else {
            this.checkRoundEnd();
        }
    }

    private checkRoundEnd() {
        const state = this.currentState;
        const players = state.players;
        const maxBet = Math.max(...players.map(p => p.currentBet));
        const allMatched = players.every(p => p.isFolded || p.isEliminated || p.currentBet === maxBet || (p.isAllIn && p.chips === 0));

        const actors = players.filter(p => !p.isFolded && !p.isEliminated && !p.isAllIn);

        // If 0 or 1 person can act, and everything is matched, the street is over.
        // (If 1 person can act but hasn't matched yet, we continue to the rotation below to let them act).
        if (actors.length <= 1 && allMatched) {
            if (state.currentPhase === 'river') {
                this.advancePhase();
            } else {
                this.updateState({ ...state, waitingForPhaseAdvancement: true });
            }
            return;
        }

        let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
        let count = 0;

        // Find next player who is still in and NOT all-in
        while (count < players.length) {
            const p = players[nextIndex];
            if (!p.isFolded && !p.isEliminated && !p.isAllIn) {
                break;
            }
            nextIndex = (nextIndex + 1) % state.players.length;
            count++;
        }

        const noOneCanAct = count >= players.length;
        // The round is over if:
        // 1. No one else can act.
        // 2. OR the next person to act has already acted this street and the bets are matched.
        const nextPlayerAlreadyActed = !noOneCanAct && players[nextIndex].lastAction !== undefined &&
            !['FOLD', 'OUT'].includes(players[nextIndex].lastAction!);

        if (noOneCanAct || (nextPlayerAlreadyActed && allMatched)) {
            if (state.currentPhase === 'river') {
                this.advancePhase();
            } else {
                this.updateState({ ...state, waitingForPhaseAdvancement: true });
            }
        } else {
            this.updateState({ ...state, currentPlayerIndex: nextIndex });
        }
    }

    public moveDealer() {
        const state = this.currentState;
        const n = state.players.length;
        if (n === 0) return;

        const oldSBIndex = state.players.findIndex(p => p.isSmallBlind);
        const oldBBIndex = state.players.findIndex(p => p.isBigBlind);

        let finalDealerIndex: number;
        let sbIndex: number;
        let bbIndex: number;

        if (oldSBIndex === -1 || oldBBIndex === -1) {
            // First hand: use the dealerIndex set in setup
            finalDealerIndex = state.dealerIndex;
            sbIndex = (finalDealerIndex + 1) % n;
            while (state.players[sbIndex].isEliminated && sbIndex !== finalDealerIndex) {
                sbIndex = (sbIndex + 1) % n;
            }
            bbIndex = (sbIndex + 1) % n;
            while (state.players[bbIndex].isEliminated && bbIndex !== finalDealerIndex) {
                bbIndex = (bbIndex + 1) % n;
            }
        } else {
            // Dead Button Logic:
            // 1. Dealer Button moves to where the Small Blind was
            finalDealerIndex = oldSBIndex;
            // 2. Small Blind moves to where the Big Blind was
            sbIndex = oldBBIndex;
            // 3. Big Blind moves to the next active player after the old BB
            bbIndex = (oldBBIndex + 1) % n;
            while (state.players[bbIndex].isEliminated && bbIndex !== oldBBIndex) {
                bbIndex = (bbIndex + 1) % n;
            }
        }

        const updatedPlayers = state.players.map((p, i) => {
            const isD = i === finalDealerIndex;
            const isSB = i === sbIndex;
            const isBB = i === bbIndex;

            let chips = p.chips;
            let currentBet = 0;
            let finalNeedsPost = p.needsToPostDeadBlind;

            if (isSB && !p.isEliminated) {
                const amount = Math.min(chips, state.smallBlind);
                chips -= amount;
                currentBet = amount;
                finalNeedsPost = false; // Reset if they are naturally in blinds
            }
            if (isBB && !p.isEliminated) {
                const amount = Math.min(chips, state.bigBlind);
                chips -= amount;
                currentBet = amount;
                finalNeedsPost = false; // Reset if they are naturally in blinds
            }

            // Arrival Dead Blind Logic
            if (finalNeedsPost && !p.isEliminated && !isSB && !isBB) {
                const amount = Math.min(chips, state.bigBlind);
                chips -= amount;
                currentBet = amount;
                finalNeedsPost = false;
            }

            return {
                ...p,
                chips,
                currentBet,
                handContribution: currentBet,
                isDealer: isD,
                isSmallBlind: isSB,
                isBigBlind: isBB,
                isFolded: p.isEliminated,
                initialChipsForHand: p.chips,
                needsToPostDeadBlind: finalNeedsPost,
                isAllIn: !p.isEliminated && chips === 0 && currentBet > 0,
                lastAction: p.isEliminated ? 'OUT' : (p.needsToPostDeadBlind && !finalNeedsPost ? 'POST BB' : undefined),
                stats: p.isEliminated ? p.stats : {
                    ...p.stats,
                    totalHands: p.stats.totalHands + 1
                }
            };
        });

        // Calculate current player index: next active after BB
        let currentPlayerIndex = (bbIndex + 1) % n;
        while (updatedPlayers[currentPlayerIndex].isEliminated && currentPlayerIndex !== bbIndex) {
            currentPlayerIndex = (currentPlayerIndex + 1) % n;
        }

        const totalPot = updatedPlayers.reduce((sum, p) => sum + p.currentBet, 0);

        this.updateState({
            ...state,
            players: updatedPlayers,
            dealerIndex: finalDealerIndex,
            currentPhase: 'pre-flop',
            currentPlayerIndex: currentPlayerIndex,
            lastAggressorIndex: -1,
            pot: totalPot,
            isHandOver: false,
            waitingForPhaseAdvancement: false,
            history: []
        });
    }

    private createEmptyStats(): PlayerStats {
        return {
            preFlopFolds: 0,
            flopFolds: 0,
            turnFolds: 0,
            riverFolds: 0,
            raises: 0,
            allIns: 0,
            handsWon: 0,
            totalHands: 0,
            handsOpened: 0,
            threeBets: 0,
            voluntarilyPlayed: 0,
            eliminations: 0
        };
    }

    public advancePhase() {
        const state = this.currentState;
        if (state.isHandOver) {
            this.moveDealer();
            return;
        }

        const nextPhases: Record<PokerPhase, PokerPhase> = {
            'pre-flop': 'flop',
            'flop': 'turn',
            'turn': 'river',
            'river': 'showdown',
            'showdown': 'pre-flop'
        };

        const newPhase = nextPhases[state.currentPhase];

        if (newPhase === 'pre-flop') {
            this.moveDealer();
        } else {
            let firstPlayer = (state.dealerIndex + 1) % state.players.length;
            let count = 0;
            while ((state.players[firstPlayer].isFolded || state.players[firstPlayer].isEliminated || state.players[firstPlayer].isAllIn) && count < state.players.length) {
                firstPlayer = (firstPlayer + 1) % state.players.length;
                count++;
            }

            // Reset lastAction for EVERYONE to clear pre-flon labels and track round progress
            const resetPlayers = state.players.map(p => ({
                ...p,
                currentBet: 0,
                lastAction: p.isFolded ? 'FOLD' : (p.isEliminated ? 'OUT' : undefined)
            }));

            this.updateState({
                ...state,
                currentPhase: newPhase,
                currentPlayerIndex: firstPlayer,
                lastAggressorIndex: -1,
                waitingForPhaseAdvancement: false,
                players: resetPlayers
            });

            if (newPhase !== 'showdown') {
                // Re-check state: if only 0 or 1 player has chips left, the street is over immediately
                const actors = resetPlayers.filter(p => !p.isFolded && !p.isEliminated && !p.isAllIn);
                if (actors.length <= 1) {
                    this.checkRoundEnd();
                }
            }
        }
    }

    public resolveHand(winnerIds: string[]) {
        const state = this.currentState;
        const winners = state.players.filter(p => winnerIds.includes(p.id));
        if (winners.length === 0) return;

        // 1. Find the min contribution among these winners to determine the size of the pot resolve
        const minContribution = Math.min(...winners.map(w => w.handContribution));
        if (minContribution <= 0) {
            // If winner has no contribution (shouldn't happen) but money exists, 
            // we just give they all pot if we want, but logically they win what they covered.
            // If they covered 0, they win 0 from others.
            // Let's just avoid infinite loop.
            this.updateState({ ...state, isHandOver: true });
            return;
        }

        // 2. Each player (even folded ones) contributes up to minContribution to this win
        let potResolved = 0;
        const playersAfterPot = state.players.map(p => {
            const contributionToThisPot = Math.min(p.handContribution, minContribution);
            potResolved += contributionToThisPot;
            return {
                ...p,
                handContribution: p.handContribution - contributionToThisPot
            };
        });

        const share = Math.floor(potResolved / winners.length);
        const finalPlayers = playersAfterPot.map(p => {
            if (winnerIds.includes(p.id)) {
                return {
                    ...p,
                    chips: p.chips + share,
                    stats: { ...p.stats, handsWon: p.stats.handsWon + 1 },
                    lastAction: 'WINNER'
                };
            }
            return p;
        });

        // 3. Keep track of which players got bust by this win to count eliminations
        // (A player is bust if they had contribution > 0, are not winners, and now have 0 chips)
        // Note: This is a bit complex as eliminations usually happen at the end of resolution.
        // For now, let's keep it simple: the winner of the pot "eliminates" anyone they bust.
        // But we already have a separate eliminatePlayer call in the UI.
        // Let's modify the UI to pass the winnerId when eliminating.

        const remainingPot = Math.max(0, state.pot - potResolved);

        // If pot is empty or no one else is in, hand is over.
        // Otherwise, keep isHandOver false to let UI select next winner for side pot.
        const canContinue = remainingPot > 0 && finalPlayers.some(p => p.handContribution > 0 && !p.isFolded && !p.isEliminated);

        this.updateState({
            ...state,
            players: finalPlayers,
            pot: remainingPot,
            isHandOver: !canContinue
        });
    }

    public setBlinds(smallBlind: number, bigBlind: number) {
        const state = this.currentState;
        this.updateState({
            ...state,
            smallBlind,
            bigBlind,
            minRaise: bigBlind
        });
    }

    public async getActiveGames(): Promise<{ id: string, state: GameState }[]> {
        const gamesCol = collection(this.firestore, 'games');
        const snapshot = await getDocs(gamesCol);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            state: this.deserializeState(doc.data() as any)
        }));
    }

    public resetGame() {
        this.updateState(this.initialState);
    }
}
