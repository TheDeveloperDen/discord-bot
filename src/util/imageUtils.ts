import {Canvas, createCanvas, NodeCanvasRenderingContext2D, registerFont} from "canvas";

registerFont('Horta.otf', {family: 'Horta'})

export const createImage = (width: number, height: number, color: string): [Canvas, NodeCanvasRenderingContext2D] => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d')!!;
    ctx.font = 'Horta';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return [canvas, ctx];
};