interface Array<T> {
	randomElement(): T
}

Array.prototype.randomElement = function randomElement() {
	if(this.length == 1) {
		return this[0]
	}
	return this[Math.floor(Math.random() * this.length)]
}
