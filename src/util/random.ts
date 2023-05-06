// Used to add randomElement, eslint is dumb
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Array<T> {
  randomElement: () => T
}

// eslint-disable-next-line no-extend-native
Array.prototype.randomElement = function randomElement () {
  if (this.length === 1) {
    return this[0]
  }
  return this[Math.floor(Math.random() * this.length)]
}
