import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ensureSchoolYear } from './db';
import { initAuth } from './sync/onedrive';
import { startSync } from './sync/engine';
import './styles.css';

// Bittet den Browser, die Daten nicht automatisch zu löschen, wenn der Speicher knapp wird.
navigator.storage?.persist?.().catch(() => undefined);

async function boot(): Promise<void> {
  await ensureSchoolYear();
  try {
    // Muss vor dem Rendern laufen: verarbeitet die Rückkehr von der Microsoft-Anmeldung
    await initAuth();
  } catch (e) {
    console.error('Microsoft-Anmeldung konnte nicht initialisiert werden', e);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  void startSync();
}

void boot();
