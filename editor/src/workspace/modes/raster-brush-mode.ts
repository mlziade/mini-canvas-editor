import { Point, TPointerEvent } from 'mini-canvas-core';
import type { EditorState } from '../../editor-state';
import { BrushKind, BrushOptions, BrushStroke } from '../../raster/brush-stroke';
import { RasterLayer, RasterPatch } from '../../raster/raster-layer';
import { resolveRasterLayer } from '../../raster/targets';
import { BrushCursor } from '../brush-cursor';
import { DragPainter } from './drag-painter';
import { WorkspaceMode } from './workspace-mode';

export interface BrushModeSettings {
	kind: BrushKind;
	getOptions(): Omit<BrushOptions, 'kind' | 'limit'>;
	/**
	 * Lets the mode ignore a pointer down before anything is touched.
	 */
	shouldStart?(event: TPointerEvent): boolean;
	/**
	 * Lets the mode block or redirect a stroke. Called when the pointer goes down.
	 * Return false to ignore the stroke.
	 */
	onPointerDown?(point: Point, event: TPointerEvent, layer: RasterLayer): boolean;
	getCloneOffset?(layer: RasterLayer, point: Point): { x: number; y: number } | undefined;
}

/**
 * Base for the modes that paint on the pixels of a layer: eraser, clone stamp and blur brush.
 */
export class RasterBrushMode implements WorkspaceMode {
	private painter?: DragPainter;
	private cursor?: BrushCursor;
	private stroke: BrushStroke | null = null;
	private finishHistory: (() => void) | null = null;

	public constructor(
		protected readonly state: EditorState,
		private readonly settings: BrushModeSettings
	) {}

	public init() {
		this.cursor = BrushCursor.create(this.state, () => this.settings.getOptions().size);
		this.painter = DragPainter.create(this.state, {
			onStart: (point, event) => this.onStart(point, event),
			onMove: (_start, point) => this.stroke?.move(point),
			onEnd: () => this.onEnd()
		}, 'crosshair', false);
	}

	public destroy() {
		this.cursor?.destroy();
		this.painter?.destroy();
		this.cursor = undefined;
		this.painter = undefined;
		if (this.stroke) {
			this.onEnd();
		}
	}

	private onStart(point: Point, event: TPointerEvent): boolean {
		if (this.settings.shouldStart && !this.settings.shouldStart(event)) {
			return false;
		}
		const history = this.state.history;
		const before = history.begin();
		const patches: RasterPatch[] = [];
		const layer = this.safeResolve(point);
		if (!layer) {
			history.end(before, []);
			return false;
		}
		if (this.settings.onPointerDown && !this.settings.onPointerDown(point, event, layer)) {
			history.end(before, []);
			return false;
		}

		const selection = this.state.getSelection();
		const limit = selection ? layer.createMaskCanvas(selection) : null;
		const options = this.settings.getOptions();
		this.stroke = new BrushStroke(layer, {
			...options,
			kind: this.settings.kind,
			limit,
			cloneOffset: this.settings.getCloneOffset?.(layer, point)
		});
		this.stroke.start(point);
		this.finishHistory = () => {
			const patch = this.stroke?.finish();
			if (patch) {
				patches.push(patch);
			}
			history.end(before, patches);
		};
		return true;
	}

	private safeResolve(point: Point): RasterLayer | null {
		try {
			return resolveRasterLayer(this.state, point);
		} catch (e) {
			// Typically a canvas tainted by a cross-origin image.
			console.warn('The pixels of this layer cannot be edited.', e);
			return null;
		}
	}

	private onEnd() {
		this.finishHistory?.();
		this.finishHistory = null;
		this.stroke = null;
	}
}
