import { Routes } from '@angular/router';
import { SetupComponent } from './components/setup/setup.component';
import { GameComponent } from './components/game/game.component';
import { InfoComponent } from './components/info/info.component';
import { ReplayComponent } from './components/replay/replay.component';

export const routes: Routes = [
    { path: '', redirectTo: 'setup', pathMatch: 'full' },
    { path: 'setup', component: SetupComponent },
    { path: 'game', component: GameComponent },
    { path: 'info', component: InfoComponent },
    { path: 'replay', component: ReplayComponent },
];
