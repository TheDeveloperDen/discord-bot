import { DiscordSDK } from "@discord/embedded-app-sdk";
import {
	type Block,
	generatePuzzle,
	isSolved,
	type Puzzle,
	validatePlacement,
} from "./game.js";
import { getCellsCrossedByGridSegment } from "./pointerGeometry.js";

const BOARD_SIZE = 8;
const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;
const STORAGE_KEY = "blockcount:progress:v1";
const PALETTE = [
	"#5fd9e5",
	"#7198ff",
	"#ff7279",
	"#72dfa2",
	"#ca8aff",
	"#f2b948",
	"#f47fbd",
	"#a9db5c",
	"#ff9f62",
	"#72c9ff",
] as const;
type PersistedProgress = {
	seed: string;
	blocks: Block[];
};

type GameSnapshot = PersistedProgress & {
	focusedCell: number;
};

type PendingAction = "reset" | "new";

type Tone = "default" | "error" | "success";

const app = document.querySelector<HTMLElement>("#app");
if (!app) {
	throw new Error("BlockCount could not find its application root.");
}

app.innerHTML = `
	<section class="game" aria-label="BlockCount puzzle">
		<header class="topbar">
			<h1 class="brand">BlockCount</h1>
			<nav class="toolbar" aria-label="Puzzle controls">
				<button id="help-button" class="icon-button" type="button" aria-label="How to play">?</button>
				<div class="toolbar-actions">
					<button id="undo-button" class="control-button" type="button">Undo</button>
					<button id="reset-button" class="control-button control-button--accent" type="button">Reset</button>
					<button id="new-button" class="control-button" type="button">New</button>
				</div>
			</nav>
		</header>
		<p id="instruction" class="instruction">Draw cells · release to place · tap to erase</p>
		<div class="board-frame">
			<div id="board" class="board" role="grid" aria-label="BlockCount board"></div>
		</div>
		<div class="meta-row" aria-label="Puzzle progress">
			<div class="progress-copy"><span id="covered-count">0</span><span>of ${TOTAL_CELLS} cells covered</span></div>
			<div><span id="block-count">0</span> blocks</div>
			<div class="progress-track" aria-hidden="true"><span id="progress-bar"></span></div>
		</div>
		<div class="status-wrap" aria-live="polite" aria-atomic="true">
			<p id="status-message" class="status-message"></p>
			<p id="storage-notice" class="storage-notice" hidden></p>
		</div>
		<div id="completion" class="completion" hidden>
			<section class="completion-card" role="status" aria-labelledby="completion-title">
				<div class="completion-icon" aria-hidden="true"></div>
				<h2 id="completion-title">Puzzle complete!</h2>
				<p>You covered every cell with matching connected blocks.</p>
				<button id="play-again-button" class="primary-button" type="button">Play another puzzle</button>
			</section>
		</div>
		<dialog id="help-dialog" class="help-dialog" aria-labelledby="help-title">
			<div class="help-dialog-inner">
				<h2 id="help-title">How to play</h2>
				<ul class="help-list">
					<li><span class="help-icon" aria-hidden="true">1</span><span><strong>Draw a shape</strong>Drag through side-adjacent cells. Lines, turns, and branched shapes all work.</span></li>
					<li><span class="help-icon" aria-hidden="true">2</span><span><strong>Match the clue</strong>Each block needs exactly one number and that many cells.</span></li>
					<li><span class="help-icon" aria-hidden="true">3</span><span><strong>Fill the board</strong>Cover every cell without overlapping blocks.</span></li>
					<li><span class="help-icon" aria-hidden="true">4</span><span><strong>Use the keyboard</strong>Arrow keys move, Space adds a cell, Enter places, Delete removes a placed block, and Escape cancels.</span></li>
				</ul>
				<button id="help-close" class="dialog-close" type="button">Got it!</button>
			</div>
		</dialog>
		<dialog id="confirmation-dialog" class="help-dialog confirmation-dialog" aria-labelledby="confirmation-title">
			<div class="help-dialog-inner">
				<h2 id="confirmation-title">Confirm action</h2>
				<p id="confirmation-copy" class="dialog-copy"></p>
				<div class="dialog-actions">
					<button id="confirmation-cancel" class="control-button" type="button">Keep playing</button>
					<button id="confirmation-accept" class="dialog-close" type="button">Confirm</button>
				</div>
			</div>
		</dialog>
		<div id="fatal-state" class="fatal-state" hidden>
			<section class="fatal-card" role="alert" aria-labelledby="fatal-title">
				<span class="fatal-symbol" aria-hidden="true">!</span>
				<h2 id="fatal-title">Activity unavailable</h2>
				<p id="fatal-copy"></p>
			</section>
		</div>
	</section>
`;

const game = requiredElement<HTMLElement>(".game");
const board = requiredElement<HTMLElement>("#board");
const instruction = requiredElement<HTMLElement>("#instruction");
const coveredCount = requiredElement<HTMLElement>("#covered-count");
const blockCount = requiredElement<HTMLElement>("#block-count");
const progressBar = requiredElement<HTMLElement>("#progress-bar");
const statusMessage = requiredElement<HTMLElement>("#status-message");
const storageNotice = requiredElement<HTMLElement>("#storage-notice");
const undoButton = requiredElement<HTMLButtonElement>("#undo-button");
const resetButton = requiredElement<HTMLButtonElement>("#reset-button");
const newButton = requiredElement<HTMLButtonElement>("#new-button");
const helpButton = requiredElement<HTMLButtonElement>("#help-button");
const helpDialog = requiredElement<HTMLDialogElement>("#help-dialog");
const helpClose = requiredElement<HTMLButtonElement>("#help-close");
const confirmationDialog = requiredElement<HTMLDialogElement>(
	"#confirmation-dialog",
);
const confirmationTitle = requiredElement<HTMLElement>("#confirmation-title");
const confirmationCopy = requiredElement<HTMLElement>("#confirmation-copy");
const confirmationCancel = requiredElement<HTMLButtonElement>(
	"#confirmation-cancel",
);
const confirmationAccept = requiredElement<HTMLButtonElement>(
	"#confirmation-accept",
);
const completion = requiredElement<HTMLElement>("#completion");
const playAgainButton =
	requiredElement<HTMLButtonElement>("#play-again-button");
const fatalState = requiredElement<HTMLElement>("#fatal-state");
const fatalCopy = requiredElement<HTMLElement>("#fatal-copy");

let seed = createSeed();
let puzzle: Puzzle = generatePuzzle(seed).puzzle;
let blocks: Block[] = [];
let selection: number[] = [];
let activePointerId: number | null = null;
let pointerX: number | null = null;
let pointerY: number | null = null;
let removalCandidate: number | null = null;
let focusedCell = 0;
let restoredNotice: string | null = null;
let storageAvailable = true;
const undoSnapshots: GameSnapshot[] = [];
let pendingAction: PendingAction | null = null;

restoreProgress();
render();
app.setAttribute("aria-busy", "false");
void connectToDiscord();

helpButton.addEventListener("click", () => helpDialog.showModal());
helpClose.addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
	if (event.target === helpDialog) {
		helpDialog.close();
	}
});
window.addEventListener("keydown", (event) => {
	if (event.key !== "Escape" || activePointerId === null) return;
	event.preventDefault();
	cancelActivePointer();
});

undoButton.addEventListener("click", () => {
	const snapshot = undoSnapshots.pop();
	if (!snapshot) return;
	restoreSnapshot(snapshot);
	persistProgress();
	setStatus("Undid your last change.");
	render();
});

resetButton.addEventListener("click", () => {
	if (blocks.length === 0) {
		resetPuzzle();
		return;
	}
	requestConfirmation("reset");
});

newButton.addEventListener("click", () => {
	if (blocks.length === 0) {
		startNewPuzzle();
		return;
	}
	requestConfirmation("new");
});

playAgainButton.addEventListener("click", startNewPuzzle);

confirmationCancel.addEventListener("click", () => confirmationDialog.close());
confirmationAccept.addEventListener("click", () => {
	const action = pendingAction;
	pendingAction = null;
	confirmationDialog.close();
	if (action === "reset") resetPuzzle();
	if (action === "new") startNewPuzzle();
});
confirmationDialog.addEventListener("close", () => {
	pendingAction = null;
});

board.addEventListener("pointerdown", (event) => {
	if (event.button !== 0 || activePointerId !== null || isComplete()) return;
	const cell = getCellAtPoint(event.clientX, event.clientY);
	if (cell === null) return;

	event.preventDefault();
	activePointerId = event.pointerId;
	pointerX = event.clientX;
	pointerY = event.clientY;
	board.setPointerCapture(event.pointerId);

	const placedBlock = findBlockAt(cell);
	if (placedBlock !== -1) {
		clearSelection();
		refreshSelectionPreview();
		removalCandidate = placedBlock;
		setStatus("Release to remove this block.");
		return;
	}

	selection = [];
	addToSelection(cell);
	refreshSelectionPreview();
});

board.addEventListener("pointermove", (event) => {
	if (event.pointerId !== activePointerId || removalCandidate !== null) return;
	extendSelectionThroughPointerEvent(event);
});

board.addEventListener("pointerup", (event) => {
	if (event.pointerId !== activePointerId) return;
	finishPointerInteraction(event);
});

board.addEventListener("pointercancel", (event) => {
	if (event.pointerId !== activePointerId) return;
	cancelActivePointer();
});

board.addEventListener("lostpointercapture", (event) => {
	if (event.pointerId !== activePointerId) return;
	clearPointerTracking();
	clearSelection();
	removalCandidate = null;
	refreshSelectionPreview();
	setStatus("Selection cancelled.");
});

board.addEventListener("keydown", (event) => {
	if (!completion.hidden || !fatalState.hidden) return;
	const target = event.target;
	if (!(target instanceof HTMLButtonElement)) return;
	const cell = Number(target.dataset.cell);
	if (!Number.isInteger(cell)) return;

	if (
		event.key === "ArrowUp" ||
		event.key === "ArrowDown" ||
		event.key === "ArrowLeft" ||
		event.key === "ArrowRight"
	) {
		event.preventDefault();
		moveFocus(cell, event.key);
		return;
	}

	if (
		event.key === " " ||
		event.key === "Delete" ||
		event.key === "Backspace"
	) {
		event.preventDefault();
		const placedBlock = findBlockAt(cell);
		if (placedBlock !== -1) {
			removeBlock(placedBlock, "Block removed. Try a different shape.", true);
			return;
		}
		if (event.key !== " ") {
			setStatus(
				"Move to a placed block, then press Delete to remove it.",
				"error",
			);
			return;
		}
		if (addToSelection(cell)) {
			refreshSelectionPreview();
		} else if (!selection.includes(cell)) {
			setStatus(
				"Add a cell beside any selected cell to keep your shape connected.",
				"error",
			);
		}
		return;
	}

	if (event.key === "Enter") {
		event.preventDefault();
		commitSelection(true);
		return;
	}

	if (event.key === "Escape" && selection.length > 0) {
		event.preventDefault();
		clearSelection();
		refreshSelectionPreview();
		setStatus("Selection cancelled.");
	}
});

function requiredElement<T extends Element>(selector: string): T {
	const element = document.querySelector<T>(selector);
	if (!element) throw new Error(`BlockCount could not find ${selector}.`);
	return element;
}

function createSeed(): string {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function connectToDiscord(): Promise<void> {
	const embedded = new URLSearchParams(window.location.search).has("frame_id");
	if (!embedded) return;

	setStatus("Connecting to Discord…");
	try {
		const response = await fetch("/config.json", { cache: "no-store" });
		if (!response.ok) {
			throw new Error(
				`The activity configuration returned ${response.status}.`,
			);
		}
		const config: unknown = await response.json();
		if (!isActivityConfig(config) || !config.clientId) {
			throw new Error("The host has no Discord application ID configured.");
		}
		const discord = new DiscordSDK(config.clientId);
		await waitForDiscordReady(discord);
		setStatus("");
	} catch (error) {
		const detail =
			error instanceof Error ? error.message : "Unknown connection error.";
		showFatal(
			`This activity could not complete the Discord connection. ${detail} Check the activity host configuration, then reopen it from Discord.`,
		);
	}
}

function isActivityConfig(
	value: unknown,
): value is { clientId: string | null } {
	return (
		typeof value === "object" &&
		value !== null &&
		"clientId" in value &&
		(typeof value.clientId === "string" || value.clientId === null)
	);
}

function waitForDiscordReady(discord: DiscordSDK): Promise<void> {
	const { promise, reject, resolve } = Promise.withResolvers<void>();
	const timeout = window.setTimeout(
		() => reject(new Error("Discord did not respond within 10 seconds.")),
		10_000,
	);
	void discord.ready().then(
		() => {
			window.clearTimeout(timeout);
			resolve();
		},
		(error: unknown) => {
			window.clearTimeout(timeout);
			reject(error);
		},
	);
	return promise;
}

function showFatal(message: string): void {
	cancelActivePointer();
	clearSelection();
	removalCandidate = null;
	pendingAction = null;
	if (helpDialog.open) helpDialog.close();
	if (confirmationDialog.open) confirmationDialog.close();
	for (const child of Array.from(game.children)) {
		if (child !== fatalState && child instanceof HTMLElement)
			child.inert = true;
	}
	fatalState.inert = false;
	game.classList.add("is-unavailable");
	fatalCopy.textContent = message;
	fatalState.hidden = false;
}

function restoreProgress(): void {
	let stored: string | null;
	try {
		stored = window.localStorage.getItem(STORAGE_KEY);
	} catch {
		storageAvailable = false;
		return;
	}
	if (!stored) return;

	try {
		const parsed: unknown = JSON.parse(stored);
		if (!isPersistedProgress(parsed))
			throw new Error("Saved data has an unsupported format.");
		const generated = generatePuzzle(parsed.seed);
		const restoredBlocks = validateRestoredBlocks(
			generated.puzzle,
			parsed.blocks,
		);
		if (restoredBlocks === null)
			throw new Error("Saved data does not match this puzzle.");
		seed = parsed.seed;
		puzzle = generated.puzzle;
		blocks = restoredBlocks;
		restoredNotice =
			blocks.length > 0 ? "Your saved puzzle progress was restored." : null;
	} catch {
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch {
			storageAvailable = false;
		}
		restoredNotice = "Saved puzzle progress was invalid and has been cleared.";
	}
}

function isPersistedProgress(value: unknown): value is PersistedProgress {
	if (
		typeof value !== "object" ||
		value === null ||
		!("seed" in value) ||
		!("blocks" in value)
	)
		return false;
	return (
		typeof value.seed === "string" &&
		Array.isArray(value.blocks) &&
		value.blocks.every(isBlock)
	);
}

function isBlock(value: unknown): value is Block {
	if (
		typeof value !== "object" ||
		value === null ||
		!("clue" in value) ||
		!("cells" in value)
	)
		return false;
	return (
		typeof value.clue === "number" &&
		Array.isArray(value.cells) &&
		value.cells.every((cell) => typeof cell === "number")
	);
}

function validateRestoredBlocks(
	candidatePuzzle: Puzzle,
	candidateBlocks: readonly Block[],
): Block[] | null {
	const accepted: Block[] = [];
	for (const candidate of candidateBlocks) {
		const result = validatePlacement(
			candidatePuzzle,
			accepted,
			candidate.cells,
		);
		if (!result.ok || result.block.clue !== candidate.clue) return null;
		accepted.push(result.block);
	}
	return accepted;
}

function persistProgress(): void {
	if (!storageAvailable) {
		showStorageNotice(
			"Progress cannot be saved because browser storage is unavailable.",
		);
		return;
	}
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ seed, blocks } satisfies PersistedProgress),
		);
		showStorageNotice("");
	} catch {
		storageAvailable = false;
		showStorageNotice(
			"Progress cannot be saved because browser storage is unavailable.",
		);
	}
}

function showStorageNotice(message: string): void {
	storageNotice.textContent = message;
	storageNotice.hidden = message.length === 0;
}

function render(restoreBoardFocus = false): void {
	const occupied = new Map<number, number>();
	blocks.forEach((block, blockIndex) => {
		for (const cell of block.cells) occupied.set(cell, blockIndex);
	});
	const clues = new Map(
		puzzle.clues.map((clue, clueIndex) => [clue.cell, clueIndex]),
	);
	board.replaceChildren(
		...Array.from({ length: TOTAL_CELLS }, (_, cell) =>
			createCell(cell, occupied, clues),
		),
	);

	const covered = occupied.size;
	coveredCount.textContent = String(covered);
	blockCount.textContent = String(blocks.length);
	progressBar.style.width = `${(covered / TOTAL_CELLS) * 100}%`;
	undoButton.disabled = undoSnapshots.length === 0;
	instruction.textContent =
		selection.length > 0
			? `Selecting ${selection.length} cell${selection.length === 1 ? "" : "s"} · release or press Enter to place`
			: "Draw cells · release to place · tap to erase";
	const complete = isComplete();
	updateCompletionState(complete);
	if (restoredNotice) {
		setStatus(restoredNotice, "success");
		restoredNotice = null;
	}
	showStorageNotice(
		storageAvailable
			? ""
			: "Progress cannot be saved because browser storage is unavailable.",
	);
	if (restoreBoardFocus && !complete && fatalState.hidden)
		board
			.querySelector<HTMLButtonElement>(`[data-cell="${focusedCell}"]`)
			?.focus();
}

function updateCompletionState(complete: boolean): void {
	completion.hidden = !complete;
	if (!fatalState.hidden) return;

	for (const child of Array.from(game.children)) {
		if (
			child !== completion &&
			child !== fatalState &&
			child instanceof HTMLElement
		)
			child.inert = complete;
	}
	completion.inert = false;
	if (complete) playAgainButton.focus();
}

function createCell(
	cell: number,
	occupied: ReadonlyMap<number, number>,
	clues: ReadonlyMap<number, number>,
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "cell";
	button.dataset.cell = String(cell);
	button.setAttribute("role", "gridcell");
	button.setAttribute("aria-pressed", "false");
	button.tabIndex = cell === focusedCell ? 0 : -1;

	const clueIndex = clues.get(cell);
	const placedIndex = occupied.get(cell);
	const row = Math.floor(cell / BOARD_SIZE) + 1;
	const column = (cell % BOARD_SIZE) + 1;
	const descriptor: string[] = [`Row ${row}, column ${column}`];
	if (clueIndex !== undefined) {
		const clue = puzzle.clues[clueIndex]!;
		button.textContent = String(clue.size);
		button.classList.add("cell--clue");
		button.style.setProperty(
			"--clue-color",
			PALETTE[clueIndex % PALETTE.length]!,
		);
		descriptor.push(`clue ${clue.size}`);
	}
	if (placedIndex !== undefined) {
		const placed = blocks[placedIndex]!;
		button.classList.add("cell--placed");
		button.style.setProperty(
			"--block-color",
			PALETTE[placed.clue % PALETTE.length]!,
		);
		descriptor.push("placed block; tap to remove");
	}
	button.setAttribute("aria-label", descriptor.join(", "));
	return button;
}

function refreshSelectionPreview(): void {
	const selected = new Set(selection);
	const placement =
		selection.length > 0 ? validatePlacement(puzzle, blocks, selection) : null;
	const previewColor = placement?.ok
		? PALETTE[placement.block.clue % PALETTE.length]!
		: null;
	board.querySelectorAll<HTMLButtonElement>("[data-cell]").forEach((cell) => {
		const cellIndex = Number(cell.dataset.cell);
		const isSelected = selected.has(cellIndex);
		const isValidPreview = isSelected && previewColor !== null;
		cell.classList.toggle("cell--selected", isSelected);
		cell.classList.toggle("cell--selection-valid", isValidPreview);
		if (isValidPreview) cell.style.setProperty("--preview-color", previewColor);
		else cell.style.removeProperty("--preview-color");
		cell.setAttribute("aria-pressed", String(isSelected));
	});
	instruction.textContent =
		selection.length > 0
			? `Selecting ${selection.length} cell${selection.length === 1 ? "" : "s"} · release or press Enter to place`
			: "Draw cells · release to place · tap to erase";
}

function getCellAtPoint(x: number, y: number): number | null {
	const target = document.elementFromPoint(x, y);
	const cell = target?.closest<HTMLButtonElement>("[data-cell]");
	if (!cell || !board.contains(cell)) return null;
	const index = Number(cell.dataset.cell);
	return Number.isInteger(index) ? index : null;
}

function addToSelection(cell: number): boolean {
	if (selection.includes(cell) || findBlockAt(cell) !== -1) return false;
	if (
		selection.length > 0 &&
		!selection.some((selectedCell) => areAdjacent(selectedCell, cell))
	)
		return false;
	selection.push(cell);
	return true;
}

function areAdjacent(first: number, second: number): boolean {
	const firstRow = Math.floor(first / BOARD_SIZE);
	const firstColumn = first % BOARD_SIZE;
	const secondRow = Math.floor(second / BOARD_SIZE);
	const secondColumn = second % BOARD_SIZE;
	return (
		Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1
	);
}

function extendSelectionThroughPointerEvent(event: PointerEvent): boolean {
	let selectionChanged = false;
	for (const sample of event.getCoalescedEvents?.() ?? []) {
		const changed = extendSelectionToPoint(sample.clientX, sample.clientY);
		if (changed === null) return false;
		selectionChanged ||= changed;
	}
	const changed = extendSelectionToPoint(event.clientX, event.clientY);
	if (changed === null) return false;
	selectionChanged ||= changed;
	if (selectionChanged) refreshSelectionPreview();
	return true;
}

function extendSelectionToPoint(x: number, y: number): boolean | null {
	if (pointerX === null || pointerY === null) return false;
	const cells = getCellsCrossedBySegment(pointerX, pointerY, x, y);
	if (cells === null) {
		cancelActivePointer();
		return null;
	}
	pointerX = x;
	pointerY = y;

	let selectionChanged = false;
	for (const cell of cells) {
		if (selection.includes(cell)) continue;
		if (findBlockAt(cell) !== -1 || !addToSelection(cell)) break;
		selectionChanged = true;
	}
	return selectionChanged;
}

function getCellsCrossedBySegment(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
): number[] | null {
	const bounds = board.getBoundingClientRect();
	if (
		bounds.width === 0 ||
		bounds.height === 0 ||
		!isPointInsideBoard(startX, startY, bounds) ||
		!isPointInsideBoard(endX, endY, bounds)
	)
		return null;

	return getCellsCrossedByGridSegment(
		((startX - bounds.left) / bounds.width) * BOARD_SIZE,
		((startY - bounds.top) / bounds.height) * BOARD_SIZE,
		((endX - bounds.left) / bounds.width) * BOARD_SIZE,
		((endY - bounds.top) / bounds.height) * BOARD_SIZE,
		BOARD_SIZE,
	);
}

function isPointInsideBoard(x: number, y: number, bounds: DOMRect): boolean {
	return (
		x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom
	);
}

function finishPointerInteraction(event: PointerEvent): void {
	if (removalCandidate !== null) {
		const candidate = removalCandidate;
		const cell = getCellAtPoint(event.clientX, event.clientY);
		removalCandidate = null;
		releasePointer(event.pointerId);
		if (cell === null || findBlockAt(cell) !== candidate) {
			setStatus("Block removal cancelled.");
			return;
		}
		removeBlock(candidate, "Block removed. Try a different shape.");
		return;
	}

	if (!extendSelectionThroughPointerEvent(event)) return;
	releasePointer(event.pointerId);
	commitSelection();
}

function releasePointer(pointerId: number): void {
	clearPointerTracking();
	if (board.hasPointerCapture(pointerId))
		board.releasePointerCapture(pointerId);
}

function clearPointerTracking(): void {
	activePointerId = null;
	pointerX = null;
	pointerY = null;
}

function cancelActivePointer(): void {
	const pointerId = activePointerId;
	if (pointerId === null) {
		clearPointerTracking();
		return;
	}
	clearSelection();
	removalCandidate = null;
	releasePointer(pointerId);
	refreshSelectionPreview();
	setStatus("Selection cancelled.");
}

function commitSelection(restoreBoardFocus = false): void {
	if (selection.length === 0) return;
	const result = validatePlacement(puzzle, blocks, selection);
	selection = [];
	if (!result.ok) {
		setStatus(result.reason, "error");
		render(restoreBoardFocus);
		return;
	}
	captureSnapshot();
	blocks.push(result.block);
	persistProgress();
	setStatus(
		isSolved(puzzle, blocks)
			? "Every cell is covered — excellent work!"
			: "Block placed. Keep filling the board.",
		"success",
	);
	render(restoreBoardFocus);
}

function removeBlock(
	blockIndex: number,
	message: string,
	restoreBoardFocus = false,
): void {
	clearSelection();
	captureSnapshot();
	blocks.splice(blockIndex, 1);
	persistProgress();
	setStatus(message);
	render(restoreBoardFocus);
}

function captureSnapshot(): void {
	undoSnapshots.push({
		seed,
		blocks: blocks.map((block) => ({
			clue: block.clue,
			cells: [...block.cells],
		})),
		focusedCell,
	});
}

function restoreSnapshot(snapshot: GameSnapshot): void {
	seed = snapshot.seed;
	puzzle = generatePuzzle(seed).puzzle;
	blocks = snapshot.blocks.map((block) => ({
		clue: block.clue,
		cells: [...block.cells],
	}));
	focusedCell = snapshot.focusedCell;
	clearSelection();
}

function resetPuzzle(): void {
	if (blocks.length > 0) captureSnapshot();
	clearSelection();
	blocks = [];
	persistProgress();
	setStatus("Puzzle reset. Start a new shape when you are ready.");
	render();
}

function requestConfirmation(action: PendingAction): void {
	pendingAction = action;
	if (action === "reset") {
		confirmationTitle.textContent = "Reset this puzzle?";
		confirmationCopy.textContent =
			"Your placed blocks will be removed. You can undo this action afterward.";
		confirmationAccept.textContent = "Reset puzzle";
	} else {
		confirmationTitle.textContent = "Start a new puzzle?";
		confirmationCopy.textContent =
			"Your current puzzle will be replaced. You can undo this action afterward.";
		confirmationAccept.textContent = "Start new puzzle";
	}
	confirmationDialog.showModal();
}

function clearSelection(): void {
	selection = [];
}

function findBlockAt(cell: number): number {
	return blocks.findIndex((block) => block.cells.includes(cell));
}

function isComplete(): boolean {
	return isSolved(puzzle, blocks);
}

function moveFocus(cell: number, key: string): void {
	const row = Math.floor(cell / BOARD_SIZE);
	const column = cell % BOARD_SIZE;
	let next = cell;
	if (key === "ArrowUp")
		next = ((row + BOARD_SIZE - 1) % BOARD_SIZE) * BOARD_SIZE + column;
	if (key === "ArrowDown")
		next = ((row + 1) % BOARD_SIZE) * BOARD_SIZE + column;
	if (key === "ArrowLeft")
		next = row * BOARD_SIZE + ((column + BOARD_SIZE - 1) % BOARD_SIZE);
	if (key === "ArrowRight")
		next = row * BOARD_SIZE + ((column + 1) % BOARD_SIZE);
	focusedCell = next;
	board
		.querySelector<HTMLButtonElement>(`[data-cell="${cell}"]`)
		?.setAttribute("tabindex", "-1");
	const nextElement = board.querySelector<HTMLButtonElement>(
		`[data-cell="${next}"]`,
	);
	nextElement?.setAttribute("tabindex", "0");
	nextElement?.focus();
}

function startNewPuzzle(): void {
	captureSnapshot();
	clearSelection();
	seed = createSeed();
	puzzle = generatePuzzle(seed).puzzle;
	blocks = [];
	focusedCell = 0;
	persistProgress();
	setStatus("New puzzle ready. Build a shape around each clue.");
	render();
}

function setStatus(message: string, tone: Tone = "default"): void {
	statusMessage.textContent = message;
	if (tone === "default") delete statusMessage.dataset.tone;
	else statusMessage.dataset.tone = tone;
}
