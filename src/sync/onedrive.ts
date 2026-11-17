import { InteractionRequiredAuthError, PublicClientApplication, type AccountInfo } from '@azure/msal-browser';
import { MS_AUTHORITY, MS_CLIENT_ID, MS_SCOPES } from './config';

// Anmeldung bei Microsoft und Dateizugriff auf den App-Ordner in OneDrive (Microsoft Graph).

export class NotSignedInError extends Error {
  constructor() {
    super('Nicht bei Microsoft angemeldet.');
  }
}

/** Die Datei wurde zwischenzeitlich von einem anderen Gerät geändert. */
export class ConflictError extends Error {
  constructor() {
    super('Die Datei wurde zwischenzeitlich geändert.');
  }
}

const AFTER_LOGIN_KEY = 'grader.afterLogin';
const GRAPH_APPROOT = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';

let msal: PublicClientApplication | null = null;

export function isConfigured(): boolean {
  return MS_CLIENT_ID !== '';
}

function redirectUri(): string {
  return window.location.origin + window.location.pathname;
}

/** Vor dem ersten Rendern aufrufen: verarbeitet die Rückkehr von der Microsoft-Anmeldung. */
export async function initAuth(): Promise<void> {
  if (!isConfigured()) return;
  msal = new PublicClientApplication({
    auth: {
      clientId: MS_CLIENT_ID,
      authority: MS_AUTHORITY,
      redirectUri: redirectUri(),
      navigateToLoginRequestUrl: false,
    },
    cache: { cacheLocation: 'localStorage' },
  });
  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  if (result?.account) {
    msal.setActiveAccount(result.account);
    let back: string | null = null;
    try {
      back = sessionStorage.getItem(AFTER_LOGIN_KEY);
      sessionStorage.removeItem(AFTER_LOGIN_KEY);
    } catch {
      /* ignorieren */
    }
    window.location.hash = back || '#/einstellungen';
  } else if (!msal.getActiveAccount()) {
    const [first] = msal.getAllAccounts();
    if (first) msal.setActiveAccount(first);
  }
}

export function currentAccount(): AccountInfo | null {
  return msal?.getActiveAccount() ?? null;
}

/** Leitet zur Microsoft-Anmeldung weiter (die Seite wird verlassen). */
export async function login(): Promise<void> {
  if (!msal) throw new Error('Sync ist nicht eingerichtet.');
  try {
    sessionStorage.setItem(AFTER_LOGIN_KEY, window.location.hash);
  } catch {
    /* ignorieren */
  }
  await msal.loginRedirect({ scopes: MS_SCOPES, prompt: 'select_account' });
}

/** Meldet nur in dieser App ab (ohne Weiterleitung). */
export async function logout(): Promise<void> {
  const account = currentAccount();
  if (msal && account) await msal.logoutRedirect({ account, onRedirectNavigate: () => false });
}

async function accessToken(): Promise<string> {
  const account = currentAccount();
  if (!msal || !account) throw new NotSignedInError();
  try {
    return (await msal.acquireTokenSilent({ scopes: MS_SCOPES, account })).accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ scopes: MS_SCOPES, account });
    }
    throw e;
  }
}

async function graph(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  return fetch(url.startsWith('http') ? url : GRAPH_APPROOT + url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
  });
}

async function graphError(res: Response): Promise<Error> {
  if (res.status === 401) return new NotSignedInError();
  let detail = '';
  try {
    detail = (await res.json())?.error?.message ?? '';
  } catch {
    /* ignorieren */
  }
  return new Error(`OneDrive-Fehler ${res.status}${detail ? `: ${detail}` : ''}`);
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export interface RemoteFile {
  text: string;
  eTag: string;
}

/** Lädt eine Datei aus dem App-Ordner; null, wenn es sie nicht gibt. */
export async function downloadFile(path: string): Promise<RemoteFile | null> {
  // Erst die Metadaten (eTag), dann der Inhalt. Ändert sich die Datei dazwischen,
  // schlägt das spätere Hochladen mit If-Match fehl und der Sync wiederholt sich.
  const meta = await graph(`:/${encodePath(path)}`);
  if (meta.status === 404) return null;
  if (!meta.ok) throw await graphError(meta);
  const info = (await meta.json()) as { eTag: string; '@microsoft.graph.downloadUrl': string };
  const res = await fetch(info['@microsoft.graph.downloadUrl']);
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status})`);
  return { text: await res.text(), eTag: info.eTag };
}

/**
 * Lädt eine Datei hoch. Mit eTag nur, wenn sie seitdem unverändert ist;
 * mit eTag = null nur, wenn es sie noch nicht gibt. Sonst ConflictError.
 */
export async function uploadFile(path: string, text: string, eTag: string | null): Promise<void> {
  const res = await graph(`:/${encodePath(path)}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(eTag ? { 'If-Match': eTag } : { 'If-None-Match': '*' }) },
    body: text,
  });
  if (res.status === 412 || res.status === 409) throw new ConflictError();
  if (!res.ok) throw await graphError(res);
}

/** Dateinamen in einem Unterordner des App-Ordners (leer, wenn es ihn nicht gibt). */
export async function listFolder(path: string): Promise<string[]> {
  const names: string[] = [];
  let url: string | undefined = `:/${encodePath(path)}:/children?$select=name&$top=999`;
  while (url) {
    const res = await graph(url);
    if (res.status === 404) return [];
    if (!res.ok) throw await graphError(res);
    const page = (await res.json()) as { value: { name: string }[]; '@odata.nextLink'?: string };
    names.push(...page.value.map((v) => v.name));
    url = page['@odata.nextLink'];
  }
  return names;
}
