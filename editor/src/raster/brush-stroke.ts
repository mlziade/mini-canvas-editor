import { Point } from 'mini-canvas-core';
import { blurRegion } from './effects';
import { RasterLayer, RasterPatch } from './raster-layer';

export type BrushKind = 'erase' | 'clone' | 'blur';

export interface BrushOptions {
	kind: BrushKind;
	/**
	 * Diameter in workspace units.
	 */
	size: number;
	/**
	 * 0 is a soft edge, 1 is a hard edge.
	 */
	hardness: number;
	/**
	 * 0 to 1.
	 */
	opacity: number;
	/**
	 * Blur radius in workspace units (blur brush only).
	 */
	strength?: number;
	/**
	 * Vector, in layer pixels, from the painted point to the point that is copied (clone brush only).
	 */
	cloneOffset?: { x: number; y: number };
	/**
	 * Layer-sized canvas that limits where the brush works, opaque where painting is allowed.
	 */
	limit?: HTMLCanvasElement | null;
}

/**
 * One stroke of a brush that edits the pixels of a layer: eraser, clone stamp or blur brush.
 * Call `start`, then `move` for every pointer position, then `finish` to get an undo patch.
 */
export class BrushStroke {
	private readonly before: HTMLCanvasElement;
	private readonly stampSize: number;
	private readonly stamp: HTMLCanvasElement;
	private readonly stampCtx: CanvasRenderingContext2D;
	private readonly shape: HTMLCanvasElement;
	private readonly sigma: number;
	private readonly spacing: number;
	private dirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
	private last: Point | null = null;
	private carry = 0;

	public constructor(
		private readonly layer: RasterLayer,
		private readonly options: BrushOptions
	) {
		const scale = layer.getScale() || 1;
		const diameter = Math.max(1, options.size / scale);
		this.stampSize = Math.ceil(diameter) + 2;
		this.sigma = Math.max(0, (options.strength ?? 0) / scale);
		this.spacing = Math.max(1, diameter * 0.12);

		this.before = document.createElement('canvas');
		this.before.width = layer.canvas.width;
		this.before.height = layer.canvas.height;
		this.before.getContext('2d')!.drawImage(layer.canvas, 0, 0);

		this.stamp = document.createElement('canvas');
		this.stamp.width = this.stampSize;
		this.stamp.height = this.stampSize;
		this.stampCtx = this.stamp.getContext('2d', { willReadFrequently: true })!;
		this.shape = createBrushShape(this.stampSize, diameter / 2, options.hardness, options.opacity);
	}

	public start(worldPoint: Point) {
		const local = this.layer.worldToLocal(worldPoint);
		this.dab(local.x, local.y);
		this.last = local;
		this.carry = 0;
	}

	public move(worldPoint: Point) {
		if (!this.last) {
			this.start(worldPoint);
			return;
		}
		const local = this.layer.worldToLocal(worldPoint);
		const dx = local.x - this.last.x;
		const dy = local.y - this.last.y;
		const distance = Math.hypot(dx, dy);
		if (distance === 0) {
			return;
		}
		let travelled = this.spacing - this.carry;
		while (travelled <= distance) {
			const t = travelled / distance;
			this.dab(this.last.x + dx * t, this.last.y + dy * t);
			travelled += this.spacing;
		}
		this.carry = this.spacing - (travelled - distance);
		this.last = local;
		this.layer.markDirty();
	}

	/**
	 * Ends the stroke. Returns null when nothing was painted.
	 */
	public finish(): RasterPatch | null {
		this.layer.markDirty(true);
		if (!this.dirty) {
			return null;
		}
		const { x0, y0, x1, y1 } = this.dirty;
		const width = x1 - x0;
		const height = y1 - y0;
		if (width <= 0 || height <= 0) {
			return null;
		}
		return {
			layer: this.layer,
			x: x0,
			y: y0,
			before: this.before.getContext('2d')!.getImageData(x0, y0, width, height),
			after: this.layer.readPatch(x0, y0, width, height)
		};
	}

	private dab(cx: number, cy: number) {
		const size = this.stampSize;
		const x = Math.round(cx - size / 2);
		const y = Math.round(cy - size / 2);
		const ctx = this.stampCtx;

		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, size, size);

		switch (this.options.kind) {
			case 'erase':
				ctx.drawImage(this.shape, 0, 0);
				break;
			case 'clone': {
				const offset = this.options.cloneOffset ?? { x: 0, y: 0 };
				ctx.drawImage(this.before, x + offset.x, y + offset.y, size, size, 0, 0, size, size);
				ctx.globalCompositeOperation = 'destination-in';
				ctx.drawImage(this.shape, 0, 0);
				break;
			}
			case 'blur': {
				ctx.drawImage(blurRegion(this.layer.canvas, x, y, size, size, this.sigma), 0, 0);
				ctx.globalCompositeOperation = 'destination-in';
				ctx.drawImage(this.shape, 0, 0);
				break;
			}
		}

		if (this.options.limit) {
			ctx.globalCompositeOperation = 'destination-in';
			ctx.drawImage(this.options.limit, x, y, size, size, 0, 0, size, size);
		}
		ctx.globalCompositeOperation = 'source-over';

		const target = this.layer.ctx;
		target.save();
		target.globalCompositeOperation = this.options.kind === 'erase' ? 'destination-out' : 'source-over';
		target.drawImage(this.stamp, x, y);
		target.restore();

		this.addDirty(x, y, size, size);
	}

	private addDirty(x: number, y: number, width: number, height: number) {
		const x0 = Math.max(0, x);
		const y0 = Math.max(0, y);
		const x1 = Math.min(this.layer.canvas.width, x + width);
		const y1 = Math.min(this.layer.canvas.height, y + height);
		if (x1 <= x0 || y1 <= y0) {
			return;
		}
		if (!this.dirty) {
			this.dirty = { x0, y0, x1, y1 };
		} else {
			this.dirty.x0 = Math.min(this.dirty.x0, x0);
			this.dirty.y0 = Math.min(this.dirty.y0, y0);
			this.dirty.x1 = Math.max(this.dirty.x1, x1);
			this.dirty.y1 = Math.max(this.dirty.y1, y1);
		}
	}
}

/**
 * A round alpha mask: fully opaque in the middle, fading to nothing at the edge according to the hardness.
 */
export function createBrushShape(size: number, radius: number, hardness: number, opacity: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const center = size / 2;
	const r = Math.max(radius, 0.5);
	const gradient = ctx.createRadialGradient(center, center, 0, center, center, r);
	const solid = Math.min(Math.max(hardness, 0), 0.99);
	gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
	gradient.addColorStop(solid, `rgba(0,0,0,${opacity})`);
	gradient.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);
	return canvas;
}
