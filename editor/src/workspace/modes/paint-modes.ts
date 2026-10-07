import { Gradient, MceImage, MceRect, Point, Rect } from 'mini-canvas-core';
import { EditorMode, GradientType } from '../../editor-configuration';
import type { EditorState } from '../../editor-state';
import { applyRegionEffect } from '../../raster/region-effects';
import { RasterPatch } from '../../raster/raster-layer';
import { resolveRasterLayer } from '../../raster/targets';
import { DragPainter } from './drag-painter';
import { RasterBrushMode } from './raster-brush-mode';
import { WorkspaceMode } from './workspace-mode';

type GradientOptions = ConstructorParameters<typeof Gradient>[0];

/**
 * A gradient in pixel units, relative to the top-left corner of the object that uses it.
 */
export function createGradient(type: GradientType, fromColor: string, toColor: string, start: Point, end: Point): Gradient<'linear' | 'radial'> {
	const colorStops = [
		{ offset: 0, color: fromColor },
		{ offset: 1, color: toColor }
	];
	if (type === 'radial') {
		const radius = Math.max(Math.hypot(end.x - start.x, end.y - start.y), 1);
		return new Gradient({
			type: 'radial',
			gradientUnits: 'pixels',
			coords: { x1: start.x, y1: start.y, r1: 0, x2: start.x, y2: start.y, r2: radius },
			colorStops
		} as unknown as GradientOptions);
	}
	return new Gradient({
		type: 'linear',
		gradientUnits: 'pixels',
		coords: { x1: start.x, y1: start.y, x2: end.x, y2: end.y },
		colorStops
	} as unknown as GradientOptions);
}

/**
 * Drag to paint a gradient. It becomes a new layer that fills the workspace, or only the selection if there is one.
 */
export class GradientWorkspaceMode implements WorkspaceMode {
	private painter?: DragPainter;
	private rect: MceRect | null = null;
	private bounds = { x: 0, y: 0, width: 0, height: 0 };

	public constructor(private readonly state: EditorState) {}

	public init() {
		this.painter = DragPainter.create(this.state, {
			onStart: () => {
				const selection = this.state.getSelection();
				this.bounds = selection?.getBounds() ?? { x: 0, y: 0, width: this.state.canvas.workspaceWidth, height: this.state.canvas.workspaceHeight };
				this.rect = new MceRect({
					left: this.bounds.x,
					top: this.bounds.y,
					width: this.bounds.width,
					height: this.bounds.height,
					fill: 'transparent',
					strokeWidth: 0,
					label: 'Gradient'
				});
				this.state.add(this.rect);
			},
			onMove: (start, point) => {
				this.paint(start, point);
				this.state.canvas.requestRenderAll();
			},
			onEnd: (start, point) => {
				const rect = this.rect;
				this.rect = null;
				if (!rect) {
					return;
				}
				if (Math.hypot(point.x - start.x, point.y - start.y) < 2) {
					this.state.canvas.remove(rect);
					return;
				}
				this.rect = rect;
				this.paint(start, point);
				this.rect = null;
				const selection = this.state.getSelection();
				if (selection) {
					this.bake(rect, selection.getAlphaCanvas());
				} else {
					this.state.canvas.setActiveObject(rect);
					this.state.setMode(EditorMode.select);
				}
			}
		});
	}

	public destroy() {
		if (this.rect) {
			this.state.canvas.remove(this.rect);
			this.rect = null;
		}
		this.painter?.destroy();
		this.painter = undefined;
	}

	private paint(start: Point, point: Point) {
		if (!this.rect) {
			return;
		}
		const { type, fromColor, toColor } = this.state.gradient;
		const origin = new Point(this.bounds.x, this.bounds.y);
		this.rect.set('fill', createGradient(type, fromColor, toColor, start.subtract(origin), point.subtract(origin)));
	}

	/**
	 * With a selection, the gradient is cut to the selection and becomes a plain image layer.
	 */
	private bake(rect: MceRect, selection: HTMLCanvasElement) {
		const state = this.state;
		const canvas = document.createElement('canvas');
		canvas.width = state.canvas.workspaceWidth;
		canvas.height = state.canvas.workspaceHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(rect.toCanvasElement({ multiplier: 1, enableRetinaScaling: false }), this.bounds.x, this.bounds.y);
		ctx.globalCompositeOperation = 'destination-in';
		ctx.drawImage(selection, 0, 0);

		const index = state.canvas.getObjects().indexOf(rect);
		state.canvas.remove(rect);
		const image = new MceImage(canvas as unknown as HTMLImageElement, {
			left: 0,
			top: 0,
			width: canvas.width,
			height: canvas.height,
			label: 'Gradient'
		});
		state.canvas.insertAt(index, image);
	}
}

/**
 * Blurs or pixelates the pixels of a layer, either with a brush or inside a box.
 */
export class BlurWorkspaceMode implements WorkspaceMode {
	private inner?: WorkspaceMode;
	private shape: string | null = null;

	public constructor(private readonly state: EditorState) {}

	public init() {
		this.reload();
		this.state.onToolOptionsChanged.subscribe(this.reload);
	}

	public destroy() {
		this.state.onToolOptionsChanged.unsubscribe(this.reload);
		this.inner?.destroy();
		this.inner = undefined;
		this.shape = null;
	}

	private readonly reload = () => {
		if (this.shape === this.state.blur.shape) {
			return;
		}
		this.inner?.destroy();
		this.shape = this.state.blur.shape;
		const state = this.state;
		this.inner =
			this.shape === 'brush'
				? new RasterBrushMode(state, {
						kind: 'blur',
						getOptions: () => ({
							size: state.blur.size,
							hardness: state.blur.hardness,
							opacity: 1,
							strength: state.blur.strength
						})
					})
				: new BlurAreaMode(state);
		this.inner.init();
	};
}

class BlurAreaMode implements WorkspaceMode {
	private painter?: DragPainter;
	private preview: Rect | null = null;

	public constructor(private readonly state: EditorState) {}

	public init() {
		this.painter = DragPainter.create(this.state, {
			onStart: () => {
				this.preview = new Rect({
					fill: 'rgba(80,140,255,0.15)',
					stroke: '#ffffff',
					strokeWidth: 1,
					strokeUniform: true,
					strokeDashArray: [6, 4],
					selectable: false,
					evented: false
				});
				this.state.canvas.add(this.preview);
			},
			onMove: (start, point) => {
				this.fit(start, point);
				this.state.canvas.requestRenderAll();
			},
			onEnd: (start, point) => this.apply(start, point)
		});
	}

	public destroy() {
		this.removePreview();
		this.painter?.destroy();
		this.painter = undefined;
	}

	private fit(start: Point, point: Point) {
		this.preview?.set({
			left: Math.min(start.x, point.x),
			top: Math.min(start.y, point.y),
			width: Math.abs(point.x - start.x),
			height: Math.abs(point.y - start.y)
		});
	}

	private removePreview() {
		if (this.preview) {
			this.state.canvas.remove(this.preview);
			this.preview = null;
		}
	}

	private apply(start: Point, point: Point): RasterPatch[] {
		this.removePreview();
		const width = Math.abs(point.x - start.x);
		const height = Math.abs(point.y - start.y);
		if (width < 2 || height < 2) {
			return [];
		}
		const layer = resolveRasterLayer(this.state, new Point(start.x, start.y)) ?? resolveRasterLayer(this.state, new Point(start.x + (point.x - start.x) / 2, start.y + (point.y - start.y) / 2));
		if (!layer) {
			return [];
		}

		const mask = document.createElement('canvas');
		mask.width = layer.canvas.width;
		mask.height = layer.canvas.height;
		const ctx = mask.getContext('2d')!;
		const m = layer.getWorldToLocalMatrix();
		ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
		ctx.fillStyle = '#fff';
		ctx.fillRect(Math.min(start.x, point.x), Math.min(start.y, point.y), width, height);
		const selection = this.state.getSelection();
		if (selection) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalCompositeOperation = 'destination-in';
			ctx.drawImage(layer.createMaskCanvas(selection), 0, 0);
		}

		const { effect, strength } = this.state.blur;
		const patch = applyRegionEffect(layer, mask, effect, effect === 'blur' ? strength : Math.max(strength, 2));
		return patch ? [patch] : [];
	}
}
