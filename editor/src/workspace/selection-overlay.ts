import type { EditorState } from '../editor-state';
import { SelectionMask } from '../raster/selection-mask';

/**
 * Draws the pixel selection over the workspace: a light tint and a dashed outline.
 */
export class SelectionOverlay {
	public static create(state: EditorState): SelectionOverlay {
		const overlay = new SelectionOverlay(state);
		state.canvas.on('after:render', overlay.onAfterRender);
		state.onSelectionChanged.subscribe(overlay.onSelectionChanged);
		return overlay;
	}

	private cache: { mask: SelectionMask; version: number; canvas: HTMLCanvasElement } | null = null;

	private constructor(private readonly state: EditorState) {}

	public destroy() {
		this.state.canvas.off('after:render', this.onAfterRender);
		this.state.onSelectionChanged.unsubscribe(this.onSelectionChanged);
	}

	private readonly onSelectionChanged = () => {
		this.state.canvas.requestRenderAll();
	};

	private readonly onAfterRender = (event: { ctx: CanvasRenderingContext2D }) => {
		const canvas = this.state.canvas;
		const ctx = event.ctx;
		// Only the visible canvas gets the overlay. Exporting renders into other contexts and must stay clean.
		if (ctx !== canvas.getContext()) {
			return;
		}
		const mask = this.state.getSelection();
		if (!mask) {
			return;
		}
		if (!this.cache || this.cache.mask !== mask || this.cache.version !== mask.version) {
			this.cache = { mask, version: mask.version, canvas: buildOutline(mask) };
		}
		const v = canvas.viewportTransform;
		ctx.save();
		ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(this.cache.canvas, 0, 0);
		ctx.restore();
	};
}

function buildOutline(mask: SelectionMask): HTMLCanvasElement {
	const { width, height, data } = mask;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	const image = ctx.createImageData(width, height);
	const pixels = image.data;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			if (!data[i]) {
				continue;
			}
			const o = i * 4;
			const isEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1 || !data[i - 1] || !data[i + 1] || !data[i - width] || !data[i + width];
			if (isEdge) {
				const dark = ((x + y) >> 2) % 2 === 0;
				pixels[o] = pixels[o + 1] = pixels[o + 2] = dark ? 0 : 255;
				pixels[o + 3] = 255;
			} else {
				pixels[o] = 70;
				pixels[o + 1] = 140;
				pixels[o + 2] = 255;
				pixels[o + 3] = 50;
			}
		}
	}
	ctx.putImageData(image, 0, 0);
	return canvas;
}
