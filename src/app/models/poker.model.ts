export interface Player {
    id: string;
    name: string;
    chips: number;
    rebuyCount: number;
    initialChips: number;
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
    isFolded: boolean;
    isActive: boolean; // Not folded and not all-in
    isAllIn: boolean;
    isEliminated: boolean;
    position: number;
    currentBet: number;
    handContribution: number;
    initialChipsForHand: number;
    needsToPostDeadBlind: boolean;
    lastAction?: string;
    stats: PlayerStats;
}

export interface PlayerStats {
    preFlopFolds: number;
    flopFolds: number;
    turnFolds: number;
    riverFolds: number;
    raises: number;
    allIns: number;
    handsWon: number;
    totalHands: number;       // Number of hands received
    handsOpened: number;      // First person to raise pre-flop
    threeBets: number;        // Raised over a previous raise
    voluntarilyPlayed: number; // VPIP (Voluntarily Put In Pot - preflop call or raise)
    eliminations: number;      // Number of players eliminated by this player
}

export type PokerPhase = 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface Card {
    rank: string;
    suit: 'H' | 'D' | 'C' | 'S';
}

export interface HandReplay {
    id: string;
    timestamp: Date;
    players: {
        id: string;
        name: string;
        holeCards?: [Card, Card];
        isWinner: boolean;
        winAmount: number;
        isAllIn?: boolean;
        isEliminated?: boolean;
        isRebought?: boolean;
    }[];
    communityCards: Card[]; // Up to 5
    pot: number;
    bigBlind: number;
    phase: PokerPhase;
}

export interface GameState {
    players: Player[];
    dealerIndex: number;
    smallBlind: number;
    bigBlind: number;
    pot: number;
    currentPhase: PokerPhase;
    currentPlayerIndex: number;
    lastAggressorIndex: number;
    minRaise: number;
    history: ActionRecord[];
    savedHands: HandReplay[];
    isHandOver: boolean;
    waitingForPhaseAdvancement: boolean;
}

export interface ActionRecord {
    playerId: string;
    playerName: string;
    action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
    amount: number;
    phase: PokerPhase;
    timestamp: Date;
}
