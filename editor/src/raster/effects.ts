/**
 * Replaces every block of pixels with its average color. Works in place.
 */
export function pixelateImageData(image: ImageData, blockSize: number): void {
	const block = Math.max(1, Math.round(blockSize));
	if (block <= 1) {
		return;
	}
	const { width, height, data } = image;
	for (let by = 0; by < height; by += block) {
		const bh = Math.min(block, height - by);
		for (let bx = 0; bx < width; bx += block) {
			const bw = Math.min(block, width - bx);
			let r = 0;
			let g = 0;
			let b = 0;
			let a = 0;
			for (let y = by; y < by + bh; y++) {
				for (let x = bx; x < bx + bw; x++) {
					const o = (y * width + x) * 4;
					const alpha = data[o + 3];
					// Weight by alpha so transparent pixels do not darken the block.
					r += data[o] * alpha;
					g += data[o + 1] * alpha;
					b += data[o + 2] * alpha;
					a += alpha;
				}
			}
			const count = bw * bh;
			const rr = a > 0 ? r / a : 0;
			const gg = a > 0 ? g / a : 0;
			const bb = a > 0 ? b / a : 0;
			const aa = a / count;
			for (let y = by; y < by + bh; y++) {
				for (let x = bx; x < bx + bw; x++) {
					const o = (y * width + x) * 4;
					data[o] = rr;
					data[o + 1] = gg;
					data[o + 2] = bb;
					data[o + 3] = aa;
				}
			}
		}
	}
}

let canvasFilterSupport: boolean | undefined;

/**
 * Whether CanvasRenderingContext2D.filter works in this browser.
 */
export function isCanvasFilterSupported(): boolean {
	if (canvasFilterSupport === undefined) {
		const ctx = document.createElement('canvas').getContext('2d');
		canvasFilterSupport = !!ctx && 'filter' in ctx;
	}
	return canvasFilterSupport;
}

/**
 * Returns a blurred copy of a rectangle of the source. Pixels outside of the rectangle
 * are used for the blur, so the result does not fade at the edges.
 */
export function blurRegion(source: CanvasImageSource, sx: number, sy: number, width: number, height: number, sigma: number): HTMLCanvasElement {
	const out = document.createElement('canvas');
	out.width = Math.max(1, Math.round(width));
	out.height = Math.max(1, Math.round(height));
	const outCtx = out.getContext('2d')!;
	if (sigma <= 0) {
		outCtx.drawImage(source, sx, sy, width, height, 0, 0, out.width, out.height);
		return out;
	}

	const pad = Math.ceil(sigma * 3);
	const padded = document.createElement('canvas');
	padded.width = out.width + pad * 2;
	padded.height = out.height + pad * 2;
	const paddedCtx = padded.getContext('2d')!;

	if (isCanvasFilterSupported()) {
		paddedCtx.filter = `blur(${sigma}px)`;
		paddedCtx.drawImage(source, sx - pad, sy - pad, padded.width, padded.height, 0, 0, padded.width, padded.height);
		paddedCtx.filter = 'none';
	} else {
		// Without canvas filters: shrink and enlarge, which smooths the image.
		const factor = Math.max(2, Math.floor(sigma * 1.5));
		const small = document.createElement('canvas');
		small.width = Math.max(1, Math.round(padded.width / factor));
		small.height = Math.max(1, Math.round(padded.height / factor));
		const smallCtx = small.getContext('2d')!;
		smallCtx.imageSmoothingEnabled = true;
		smallCtx.drawImage(source, sx - pad, sy - pad, padded.width, padded.height, 0, 0, small.width, small.height);
		paddedCtx.imageSmoothingEnabled = true;
		paddedCtx.drawImage(small, 0, 0, small.width, small.height, 0, 0, padded.width, padded.height);
	}
	outCtx.drawImage(padded, -pad, -pad);
	return out;
}
