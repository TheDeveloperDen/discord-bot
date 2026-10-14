export function getCellsCrossedByGridSegment(
	startColumnPosition: number,
	startRowPosition: number,
	endColumnPosition: number,
	endRowPosition: number,
	size: number,
): number[] {
	let column = Math.floor(startColumnPosition);
	let row = Math.floor(startRowPosition);
	const endColumn = Math.floor(endColumnPosition);
	const endRow = Math.floor(endRowPosition);
	const cells = [row * size + column];
	const columnDistance = endColumnPosition - startColumnPosition;
	const rowDistance = endRowPosition - startRowPosition;
	const columnStep = Math.sign(columnDistance);
	const rowStep = Math.sign(rowDistance);
	const columnDelta =
		columnStep === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(columnDistance);
	const rowDelta =
		rowStep === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(rowDistance);
	let columnCrossing =
		columnStep > 0
			? (Math.floor(startColumnPosition) + 1 - startColumnPosition) /
				columnDistance
			: columnStep < 0
				? (startColumnPosition - Math.floor(startColumnPosition)) /
					-columnDistance
				: Number.POSITIVE_INFINITY;
	let rowCrossing =
		rowStep > 0
			? (Math.floor(startRowPosition) + 1 - startRowPosition) / rowDistance
			: rowStep < 0
				? (startRowPosition - Math.floor(startRowPosition)) / -rowDistance
				: Number.POSITIVE_INFINITY;

	while (column !== endColumn || row !== endRow) {
		const canStepColumn = column !== endColumn;
		const canStepRow = row !== endRow;
		const nextColumnCrossing = canStepColumn
			? columnCrossing
			: Number.POSITIVE_INFINITY;
		const nextRowCrossing = canStepRow ? rowCrossing : Number.POSITIVE_INFINITY;

		if (
			Number.isFinite(nextColumnCrossing) &&
			Math.abs(nextColumnCrossing - nextRowCrossing) < 1e-9
		) {
			column += columnStep;
			cells.push(row * size + column);
			row += rowStep;
			cells.push(row * size + column);
			columnCrossing += columnDelta;
			rowCrossing += rowDelta;
		} else if (nextColumnCrossing < nextRowCrossing) {
			column += columnStep;
			cells.push(row * size + column);
			columnCrossing += columnDelta;
		} else {
			row += rowStep;
			cells.push(row * size + column);
			rowCrossing += rowDelta;
		}
	}
	return cells;
}
