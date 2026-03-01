import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDujRqPxTvzUPuO0JULkVAkpb3imUnHlKI",
  authDomain: "capitainpoker.firebaseapp.com",
  projectId: "capitainpoker",
  storageBucket: "capitainpoker.firebasestorage.app",
  messagingSenderId: "954666148180",
  appId: "1:954666148180:web:f80557f215e67ea14e68c1"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore())
  ]
};
