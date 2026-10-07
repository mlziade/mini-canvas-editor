export type SelectionOperation = 'replace' | 'add' | 'subtract' | 'intersect';

export interface PixelBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * A pixel selection in workspace coordinates. Every pixel is either selected (255) or not (0).
 */
export class SelectionMask {
	public static createEmpty(width: number, height: number): SelectionMask {
		return new SelectionMask(width, height, new Uint8Array(width * height));
	}

	public static createRect(width: number, height: number, rect: PixelBounds): SelectionMask {
		const mask = SelectionMask.createEmpty(width, height);
		const x0 = Math.max(0, Math.floor(rect.x));
		const y0 = Math.max(0, Math.floor(rect.y));
		const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
		const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
		for (let y = y0; y < y1; y++) {
			mask.data.fill(255, y * width + x0, y * width + x1);
		}
		return mask;
	}

	/**
	 * Increased on every change, so caches know when to rebuild.
	 */
	public version = 0;

	private cachedBounds: { version: number; bounds: PixelBounds | null } | null = null;

	public constructor(
		public readonly width: number,
		public readonly height: number,
		public readonly data: Uint8Array
	) {
		if (data.length !== width * height) {
			throw new Error('Invalid selection mask size');
		}
	}

	public clone(): SelectionMask {
		return new SelectionMask(this.width, this.height, this.data.slice());
	}

	public touch() {
		this.version++;
	}

	public isEmpty(): boolean {
		return this.getBounds() === null;
	}

	public getBounds(): PixelBounds | null {
		if (this.cachedBounds && this.cachedBounds.version === this.version) {
			return this.cachedBounds.bounds;
		}
		let minX = this.width;
		let minY = this.height;
		let maxX = -1;
		let maxY = -1;
		const { width, height, data } = this;
		for (let y = 0; y < height; y++) {
			const row = y * width;
			for (let x = 0; x < width; x++) {
				if (data[row + x]) {
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
			}
		}
		const bounds = maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
		this.cachedBounds = { version: this.version, bounds };
		return bounds;
	}

	public clear() {
		this.data.fill(0);
		this.touch();
	}

	public invert() {
		const data = this.data;
		for (let i = 0; i < data.length; i++) {
			data[i] = data[i] ? 0 : 255;
		}
		this.touch();
	}

	public combine(other: Uint8Array, operation: SelectionOperation) {
		const data = this.data;
		if (other.length !== data.length) {
			throw new Error('Selection sizes do not match');
		}
		switch (operation) {
			case 'replace':
				data.set(other);
				break;
			case 'add':
				for (let i = 0; i < data.length; i++) {
					if (other[i]) data[i] = 255;
				}
				break;
			case 'subtract':
				for (let i = 0; i < data.length; i++) {
					if (other[i]) data[i] = 0;
				}
				break;
			case 'intersect':
				for (let i = 0; i < data.length; i++) {
					if (!other[i]) data[i] = 0;
				}
				break;
		}
		this.touch();
	}

	private alphaCache: { version: number; canvas: HTMLCanvasElement } | null = null;

	/**
	 * Same as `toAlphaCanvas`, but the canvas is reused until the selection changes. Do not draw on it.
	 */
	public getAlphaCanvas(): HTMLCanvasElement {
		if (!this.alphaCache || this.alphaCache.version !== this.version) {
			this.alphaCache = { version: this.version, canvas: this.toAlphaCanvas() };
		}
		return this.alphaCache.canvas;
	}

	/**
	 * Returns a canvas that is opaque where the selection is and transparent elsewhere.
	 */
	public toAlphaCanvas(): HTMLCanvasElement {
		const canvas = document.createElement('canvas');
		canvas.width = this.width;
		canvas.height = this.height;
		const ctx = canvas.getContext('2d')!;
		const image = ctx.createImageData(this.width, this.height);
		const pixels = image.data;
		const data = this.data;
		for (let i = 0; i < data.length; i++) {
			if (data[i]) {
				const o = i * 4;
				pixels[o] = 255;
				pixels[o + 1] = 255;
				pixels[o + 2] = 255;
				pixels[o + 3] = 255;
			}
		}
		ctx.putImageData(image, 0, 0);
		return canvas;
	}
}
