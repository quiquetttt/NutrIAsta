let pendingWrites = 0;
let pendingUpdateBlockingOperations = 0;
const idleWaiters = new Set<() => void>();

export function getPendingWriteCount() {
  return pendingWrites;
}

export function getPendingUpdateBlockingOperationCount() {
  return pendingUpdateBlockingOperations;
}

function resolveIdleWaitersIfSafe() {
  if (pendingWrites !== 0 || pendingUpdateBlockingOperations !== 0) return;
  for (const resolve of idleWaiters) resolve();
  idleWaiters.clear();
}

export async function trackWrite<T>(operation: () => Promise<T>): Promise<T> {
  pendingWrites += 1;
  try {
    return await operation();
  } finally {
    pendingWrites -= 1;
    resolveIdleWaitersIfSafe();
  }
}

export async function trackUpdateBlockingOperation<T>(operation: () => Promise<T>): Promise<T> {
  pendingUpdateBlockingOperations += 1;
  try {
    return await operation();
  } finally {
    pendingUpdateBlockingOperations -= 1;
    resolveIdleWaitersIfSafe();
  }
}

export async function waitForUpdateSafeState(): Promise<void> {
  if (pendingWrites === 0 && pendingUpdateBlockingOperations === 0) return;
  await new Promise<void>((resolve) => idleWaiters.add(resolve));
}
