// adjusted from https://github.com/kaivi/node-canvas-text
import {Font} from 'opentype.js'
import {CanvasRenderingContext2D} from "canvas";

const measureText = (text: string, font: Font, fontSize: number) => {
	const scale = 1 / font.unitsPerEm * fontSize
	const glyphs = font.stringToGlyphs(text)
	let ascent = 0,
		descent = 0,
		width = 0

	for (let i = 0; i < glyphs.length; i++) {
		const glyph = glyphs[i]
		if (glyph.advanceWidth) {
			width += glyph.advanceWidth * scale
		}
		if (i < glyphs.length - 1) {
			const kerningValue = font.getKerningValue(glyph, glyphs[i + 1])
			width += kerningValue * scale
		}

		const {yMin, yMax} = glyph.getMetrics()

		ascent = Math.max(ascent, yMax)
		descent = Math.min(descent, yMin)
	}

	return {
		width: width,
		height: Math.abs(ascent) * scale + Math.abs(descent) * scale,
		actualBoundingBoxAscent: ascent * scale,
		actualBoundingBoxDescent: descent * scale,
		fontBoundingBoxAscent: font.ascender * scale,
		fontBoundingBoxDescent: font.descender * scale
	}
}

type Rectangle = { x: number; y: number; width: number; height: number; }

type Options = {
	minSize: number;
	maxSize: number;
	hAlign: string,
	vAlign: string,
	granularity: number;
}
export const drawText = (ctx: CanvasRenderingContext2D, text: string, fontObject: Font, rectangle: Rectangle, options: Options) => {
	if (options.minSize > options.maxSize) throw 'Min font size can not be larger than max font size'

	ctx.save()

	let fontSize = options.maxSize
	let textMetrics = measureText(text, fontObject, fontSize)
	let textWidth = textMetrics.width
	let textHeight = textMetrics.height

	while ((textWidth > rectangle.width || textHeight > rectangle.height) && fontSize >= options.minSize) {
		fontSize = fontSize - options.granularity
		textMetrics = measureText(text, fontObject, fontSize)
		textWidth = textMetrics.width
		textHeight = textMetrics.height
	}

	// Calculate text coordinates
	let xPos = rectangle.x
	let yPos = rectangle.y + rectangle.height - Math.abs(textMetrics.actualBoundingBoxDescent)

	switch (options.hAlign) {
	case 'right':
		xPos = xPos + rectangle.width - textWidth
		break
	case 'center':
	case 'middle':
		xPos = xPos + (rectangle.width / 2) - (textWidth / 2)
		break
	case 'left':
		break
	default:
		throw 'Invalid options.hAlign parameter: ' + options.hAlign
	}

	switch (options.vAlign) {
	case 'top':
		yPos = yPos - rectangle.height + textHeight
		break
	case 'center':
	case 'middle':
		yPos = yPos + textHeight / 2 - rectangle.height / 2
		break
	case 'bottom':
	case 'baseline':
		break
	default:
		throw 'Invalid options.vAlign parameter: ' + options.vAlign

	}

	// Draw text
	const fontPath = fontObject.getPath(text, xPos, yPos, fontSize, {})
	fontPath.fill = ctx.fillStyle as string
	// @ts-ignore this is quite bad but i hope it will be fine
	fontPath.draw(ctx)

	ctx.restore()
}