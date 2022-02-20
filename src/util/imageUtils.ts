import canvas, {Canvas, CanvasRenderingContext2D} from 'canvas'
import opentype from 'opentype.js'
import {branding} from './branding.js'

const {createCanvas} = canvas

export const font = opentype.loadSync(branding.font)

export const createImage = (width: number, height: number, color: string): Canvas => {
	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext('2d', {alpha: false})
	ctx.fillStyle = color
	ctx.fillRect(0, 0, width, height)
	return canvas
}

export function getCanvasContext(width: number, height: number): [Canvas, CanvasRenderingContext2D] {
	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext('2d', {alpha: false})
	return [canvas, ctx]
}