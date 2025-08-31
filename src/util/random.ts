export default function randomElementFromArray<T>(array: T[]): T | undefined {
  if (array.length === 0) {
    return undefined;
  }
  if (array.length === 1) {
    return array[0];
  }
  return array[Math.floor(Math.random() * array.length)];
}
