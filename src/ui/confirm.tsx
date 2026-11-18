import { useEffect, useState } from 'react';
import { Modal } from './Modal';

// Eigene Bestätigungsfrage statt window.confirm(): sieht überall gleich aus und
// funktioniert auch dort, wo Browser-Dialoge blockiert sind.

interface ConfirmRequest {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

let show: ((req: ConfirmRequest) => void) | null = null;

export function confirmDialog(
  message: string,
  options: { confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) {
      resolve(window.confirm(message));
      return;
    }
    show({ message, ...options, resolve });
  });
}

/** Einmal in der App einbinden. */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    show = setRequest;
    return () => {
      show = null;
    };
  }, []);

  if (!request) return null;
  const close = (ok: boolean) => {
    request.resolve(ok);
    setRequest(null);
  };

  return (
    <Modal title="Bitte bestätigen" onClose={() => close(false)}>
      <p className="confirm-text">{request.message}</p>
      <div className="actions">
        <button className={request.danger ? 'danger-solid' : 'primary'} autoFocus onClick={() => close(true)}>
          {request.confirmLabel ?? 'OK'}
        </button>
        <button onClick={() => close(false)}>Abbrechen</button>
      </div>
    </Modal>
  );
}
