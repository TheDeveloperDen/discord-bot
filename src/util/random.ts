export default function randomElementFromArray<T>(array: T[]): T {
	if (array.length === 0) {
		throw new Error("Array is empty");
	}
	if (array.length === 1) {
		return array[0];
	}
	return array[Math.floor(Math.random() * array.length)];
}
