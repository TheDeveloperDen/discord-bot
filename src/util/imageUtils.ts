import canvas, {Canvas, NodeCanvasRenderingContext2D} from 'canvas'
import opentype from 'opentype.js'

const {createCanvas} = canvas

export const hortaFont = opentype.loadSync('Horta.otf')

export const createImage = (width: number, height: number, color: string): Canvas => {
	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext('2d', {alpha: false})
	ctx.fillStyle = color
	ctx.fillRect(0, 0, width, height)
	return canvas
}

export function getCanvasContext(width: number, height: number): [Canvas, NodeCanvasRenderingContext2D] {
	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext('2d', {alpha: false})
	return [canvas, ctx]
}