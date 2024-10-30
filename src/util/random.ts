// Used to add randomElement, eslint is dumb

declare global {
    interface Array<T> {
        randomElement: () => T
    }
}


Array.prototype.randomElement = function randomElement<T>(this: T[]): T {
    if (this.length === 1) {
        return this[0]
    }
    return this[Math.floor(Math.random() * this.length)]
}
