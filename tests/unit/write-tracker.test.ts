import { describe, expect, it } from 'vitest';

import {
  getPendingUpdateBlockingOperationCount,
  getPendingWriteCount,
  trackUpdateBlockingOperation,
  trackWrite,
  waitForUpdateSafeState,
} from '@/storage/write-tracker';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('protección de actualizaciones', () => {
  it('espera tanto el procesamiento previo como la escritura posterior', async () => {
    const processing = deferred();
    const writing = deferred();
    let safe = false;

    const operation = trackUpdateBlockingOperation(async () => {
      await processing.promise;
      await trackWrite(() => writing.promise);
    });
    const waiting = waitForUpdateSafeState().then(() => {
      safe = true;
    });

    expect(getPendingUpdateBlockingOperationCount()).toBe(1);
    expect(safe).toBe(false);
    processing.resolve();
    await Promise.resolve();
    expect(getPendingWriteCount()).toBe(1);
    expect(safe).toBe(false);
    writing.resolve();
    await operation;
    await waiting;
    expect(safe).toBe(true);
  });
});
