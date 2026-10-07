import { FabricObject, MceImage, Point, TMat2D, util } from 'mini-canvas-core';
import { SelectionMask } from './selection-mask';

/**
 * Pixels of a rectangle, before and after an edit. Used to undo and redo raster edits.
 */
export interface RasterPatch {
	layer: RasterLayer;
	x: number;
	y: number;
	before: ImageData;
	after: ImageData;
}

type ImageElementAccess = {
	_originalElement: CanvasImageSource & { width: number; height: number };
};

const layers = new WeakMap<MceImage, RasterLayer>();

/**
 * Gives pixel access to an image layer. The layer's image element is replaced by a canvas
 * that tools can draw on. Filters are baked into the pixels on the way.
 */
export class RasterLayer {
	public static isRasterizable(object: FabricObject): object is MceImage {
		return object.type === 'image';
	}

	public static from(image: MceImage): RasterLayer {
		const original = (image as unknown as ImageElementAccess)._originalElement;
		const existing = layers.get(image);
		if (existing && existing.canvas === original && image.filters.length === 0) {
			return existing;
		}

		let canvas: HTMLCanvasElement;
		if (image.filters.length > 0) {
			image.applyFilters();
			canvas = copyToCanvas(image.getElement() as CanvasImageSource & { width: number; height: number });
			image.filters = [];
			image.setElement(canvas, { width: image.width, height: image.height });
		} else if (original instanceof HTMLCanvasElement) {
			canvas = original;
		} else {
			canvas = copyToCanvas(original);
			image.setElement(canvas, { width: image.width, height: image.height });
		}
		const layer = new RasterLayer(image, canvas);
		layers.set(image, layer);
		return layer;
	}

	public readonly ctx: CanvasRenderingContext2D;

	private constructor(
		public readonly image: MceImage,
		public readonly canvas: HTMLCanvasElement
	) {
		this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	}

	/**
	 * Average scale between layer pixels and workspace units.
	 */
	public getScale(): number {
		const sx = (Math.abs(this.image.scaleX) * this.image.width) / this.canvas.width;
		const sy = (Math.abs(this.image.scaleY) * this.image.height) / this.canvas.height;
		return (sx + sy) / 2;
	}

	/**
	 * Matrix that maps workspace coordinates to pixels of this layer.
	 */
	public getWorldToLocalMatrix(): TMat2D {
		const inverse = util.invertTransform(this.image.calcTransformMatrix());
		const rx = this.canvas.width / this.image.width;
		const ry = this.canvas.height / this.image.height;
		const toPixels: TMat2D = [rx, 0, 0, ry, (this.image.width / 2) * rx, (this.image.height / 2) * ry];
		return util.multiplyTransformMatrices(toPixels, inverse);
	}

	public worldToLocal(point: Point): Point {
		return point.transform(this.getWorldToLocalMatrix());
	}

	public localToWorld(point: Point): Point {
		return point.transform(util.invertTransform(this.getWorldToLocalMatrix()));
	}

	public containsLocal(point: Point): boolean {
		return point.x >= 0 && point.y >= 0 && point.x < this.canvas.width && point.y < this.canvas.height;
	}

	/**
	 * True when the workspace point lands on a visible pixel of this layer.
	 */
	public hitTest(worldPoint: Point): boolean {
		const local = this.worldToLocal(worldPoint);
		if (!this.containsLocal(local)) {
			return false;
		}
		return this.ctx.getImageData(Math.floor(local.x), Math.floor(local.y), 1, 1).data[3] > 0;
	}

	/**
	 * Draws the selection into a canvas with the pixel size of this layer.
	 * The result is opaque where the selection is.
	 */
	public createMaskCanvas(mask: SelectionMask): HTMLCanvasElement {
		const canvas = document.createElement('canvas');
		canvas.width = this.canvas.width;
		canvas.height = this.canvas.height;
		const ctx = canvas.getContext('2d')!;
		const m = this.getWorldToLocalMatrix();
		ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(mask.getAlphaCanvas(), 0, 0);
		return canvas;
	}

	/**
	 * Renders this layer, with its transform, into a canvas the size of the workspace.
	 */
	public renderToWorkspace(width: number, height: number): HTMLCanvasElement {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
		const m = this.image.calcTransformMatrix();
		ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
		ctx.drawImage(this.canvas, -this.image.width / 2, -this.image.height / 2, this.image.width, this.image.height);
		return canvas;
	}

	/**
	 * Redraws the layer. With `notify`, listeners are told that the object was modified.
	 */
	public markDirty(notify = false) {
		this.image.dirty = true;
		const canvas = this.image.canvas;
		if (canvas) {
			canvas.requestRenderAll();
			if (notify) {
				canvas.fire('object:modified', { target: this.image });
			}
		}
	}

	public readPatch(x: number, y: number, width: number, height: number): ImageData {
		return this.ctx.getImageData(x, y, width, height);
	}

	public applyPatchPixels(x: number, y: number, pixels: ImageData) {
		this.ctx.putImageData(pixels, x, y);
		this.markDirty(true);
	}
}

function copyToCanvas(source: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
	canvas.height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(source, 0, 0);
	return canvas;
}
