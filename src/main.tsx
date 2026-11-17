import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ensureSchoolYear } from './db';
import './styles.css';

// Bittet den Browser, die Daten nicht automatisch zu löschen, wenn der Speicher knapp wird.
navigator.storage?.persist?.().catch(() => undefined);

ensureSchoolYear().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
