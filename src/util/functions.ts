export function compose<T, U, V> (
  f: (x: T) => U, g: (y: U) => V): (x: T) => V {
  return x => g(f(x))
}
