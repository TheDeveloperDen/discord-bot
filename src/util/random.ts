export default function randomElementFromArray<T>(array: T[]): T {
	const element = array[Math.floor(Math.random() * array.length)];
	if (element === undefined) {
		throw new Error("Array is empty");
	}
	return element;
}
