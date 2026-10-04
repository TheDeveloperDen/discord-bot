interface ModMailThreadLock {
	tail: Promise<void>;
	pendingOperations: number;
	sealedForRemoval: boolean;
}

const threadLocks = new Map<string, ModMailThreadLock>();

/**
 * Serializes ModMail work that can read from or write to the same ticket thread.
 */
export async function withModMailThreadLock<T>(
	threadId: string,
	operation: () => Promise<T>,
): Promise<T> {
	let lock = threadLocks.get(threadId);
	if (lock == null) {
		lock = {
			tail: Promise.resolve(),
			pendingOperations: 0,
			sealedForRemoval: false,
		};
		threadLocks.set(threadId, lock);
	}

	const previousOperation = lock.tail;
	let release: () => void = () => {};
	lock.tail = new Promise<void>((resolve) => {
		release = resolve;
	});
	lock.pendingOperations += 1;

	await previousOperation;
	try {
		return await operation();
	} finally {
		lock.pendingOperations -= 1;
		release();
		if (lock.pendingOperations === 0) {
			threadLocks.delete(threadId);
		}
	}
}

export function isModMailThreadSealedForRemoval(threadId: string): boolean {
	return threadLocks.get(threadId)?.sealedForRemoval ?? false;
}

/**
 * Prevents new relays from entering a removal's commit phase.
 * Must be called while holding the thread lock.
 */
export function sealModMailThreadForRemoval(threadId: string): boolean {
	const lock = threadLocks.get(threadId);
	if (lock == null || lock.pendingOperations !== 1) return false;

	lock.sealedForRemoval = true;
	return true;
}

export function unsealModMailThreadForRemoval(threadId: string): void {
	const lock = threadLocks.get(threadId);
	if (lock != null) {
		lock.sealedForRemoval = false;
	}
}
