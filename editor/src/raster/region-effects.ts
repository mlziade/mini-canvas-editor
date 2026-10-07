import { blurRegion, pixelateImageData } from './effects';
import { PixelBounds } from './selection-mask';
import { RasterLayer, RasterPatch } from './raster-layer';

export type RegionEffect = 'blur' | 'pixelate';

/**
 * Bounding box of the opaque pixels of a mask canvas, or null when it is empty.
 */
export function getMaskBounds(mask: HTMLCanvasElement): PixelBounds | null {
	const { width, height } = mask;
	const pixels = mask.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (pixels[(y * width + x) * 4 + 3] > 8) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}
	return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function cropMask(mask: HTMLCanvasElement, bounds: PixelBounds): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = bounds.width;
	canvas.height = bounds.height;
	canvas.getContext('2d')!.drawImage(mask, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
	return canvas;
}

function takePatch(layer: RasterLayer, bounds: PixelBounds, change: () => void): RasterPatch {
	const before = layer.readPatch(bounds.x, bounds.y, bounds.width, bounds.height);
	change();
	layer.markDirty(true);
	return {
		layer,
		x: bounds.x,
		y: bounds.y,
		before,
		after: layer.readPatch(bounds.x, bounds.y, bounds.width, bounds.height)
	};
}

/**
 * Blurs or pixelates the pixels of the layer under the mask.
 * `amount` is a blur radius or a pixel block size, in workspace units.
 */
export function applyRegionEffect(layer: RasterLayer, mask: HTMLCanvasElement, effect: RegionEffect, amount: number): RasterPatch | null {
	const bounds = getMaskBounds(mask);
	if (!bounds) {
		return null;
	}
	const scale = layer.getScale() || 1;
	return takePatch(layer, bounds, () => {
		let result: HTMLCanvasElement;
		if (effect === 'blur') {
			result = blurRegion(layer.canvas, bounds.x, bounds.y, bounds.width, bounds.height, amount / scale);
		} else {
			const pixels = layer.readPatch(bounds.x, bounds.y, bounds.width, bounds.height);
			pixelateImageData(pixels, amount / scale);
			result = document.createElement('canvas');
			result.width = bounds.width;
			result.height = bounds.height;
			result.getContext('2d')!.putImageData(pixels, 0, 0);
		}

		const local = cropMask(mask, bounds);
		const resultCtx = result.getContext('2d')!;
		resultCtx.globalCompositeOperation = 'destination-in';
		resultCtx.drawImage(local, 0, 0);

		const ctx = layer.ctx;
		ctx.save();
		ctx.globalCompositeOperation = 'destination-out';
		ctx.drawImage(local, bounds.x, bounds.y);
		ctx.globalCompositeOperation = 'source-over';
		ctx.drawImage(result, bounds.x, bounds.y);
		ctx.restore();
	});
}

/**
 * Makes the pixels of the layer under the mask transparent.
 */
export function deleteRegion(layer: RasterLayer, mask: HTMLCanvasElement): RasterPatch | null {
	const bounds = getMaskBounds(mask);
	if (!bounds) {
		return null;
	}
	return takePatch(layer, bounds, () => {
		const ctx = layer.ctx;
		ctx.save();
		ctx.globalCompositeOperation = 'destination-out';
		ctx.drawImage(mask, 0, 0);
		ctx.restore();
	});
}

/**
 * Copies the pixels of the layer under the mask into a new canvas that is cropped to the selection.
 */
export function extractRegion(layer: RasterLayer, mask: HTMLCanvasElement): { canvas: HTMLCanvasElement; bounds: PixelBounds } | null {
	const bounds = getMaskBounds(mask);
	if (!bounds) {
		return null;
	}
	const canvas = document.createElement('canvas');
	canvas.width = bounds.width;
	canvas.height = bounds.height;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(layer.canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
	ctx.globalCompositeOperation = 'destination-in';
	ctx.drawImage(cropMask(mask, bounds), 0, 0);
	return { canvas, bounds };
}
