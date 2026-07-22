import { waitForUpdateSafeState } from '@/storage/write-tracker';

type UpdateListener = (waiting: ServiceWorker | null) => void;

class PwaUpdateController {
  private registration: ServiceWorkerRegistration | null = null;
  private waiting: ServiceWorker | null = null;
  private listeners = new Set<UpdateListener>();
  private reloadRequested = false;

  subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.waiting);
    return () => this.listeners.delete(listener);
  }

  async register(): Promise<void> {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    this.captureWaitingWorker();
    this.registration.addEventListener('updatefound', () => {
      const worker = this.registration?.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          this.setWaiting(this.registration?.waiting ?? worker);
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.reloadRequested) window.location.reload();
    });
    window.addEventListener('focus', () => void this.checkForUpdate());
  }

  async checkForUpdate(): Promise<void> {
    await this.registration?.update();
    this.captureWaitingWorker();
  }

  async activateWaitingUpdate(): Promise<void> {
    if (!this.waiting) return;
    await waitForUpdateSafeState();
    this.reloadRequested = true;
    this.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  private captureWaitingWorker() {
    if (this.registration?.waiting && navigator.serviceWorker.controller) {
      this.setWaiting(this.registration.waiting);
    }
  }

  private setWaiting(worker: ServiceWorker | null) {
    this.waiting = worker;
    for (const listener of this.listeners) listener(worker);
  }
}

export const pwaUpdateController = new PwaUpdateController();
