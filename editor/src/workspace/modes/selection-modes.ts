import { FabricObject, Point, TPointerEvent } from 'mini-canvas-core';
import type { EditorState } from '../../editor-state';
import { floodSelect, quickSelectDab } from '../../raster/flood-fill';
import { SelectionMask, SelectionOperation } from '../../raster/selection-mask';
import { findObjectAt, renderObjectToWorkspace } from '../../raster/targets';
import { BrushCursor } from '../brush-cursor';
import { DragPainter } from './drag-painter';
import { WorkspaceMode } from './workspace-mode';

/**
 * Shift adds to the selection, Alt subtracts from it, otherwise the operation from the toolbar is used.
 */
function resolveOperation(event: TPointerEvent, fallback: SelectionOperation): SelectionOperation {
	const mouse = event as MouseEvent;
	if (mouse.altKey) {
		return 'subtract';
	}
	if (mouse.shiftKey) {
		return 'add';
	}
	return fallback;
}

function readPixels(state: EditorState, object: FabricObject): ImageData {
	const canvas = renderObjectToWorkspace(state, object);
	return canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Click to select the pixels that look like the one under the pointer.
 */
export class MagicWandWorkspaceMode implements WorkspaceMode {
	private painter?: DragPainter;

	public constructor(private readonly state: EditorState) {}

	public init() {
		this.painter = DragPainter.create(
			this.state,
			{
				onStart: (point, event) => {
					this.select(point, event);
					return false;
				},
				onMove: () => undefined,
				onEnd: () => undefined
			},
			'crosshair',
			false
		);
	}

	public destroy() {
		this.painter?.destroy();
		this.painter = undefined;
	}

	private select(point: Point, event: TPointerEvent) {
		const state = this.state;
		const options = state.magicWand;
		const operation = resolveOperation(event, options.operation);
		const object = findObjectAt(state, point);
		if (!object) {
			if (operation === 'replace') {
				state.clearSelection();
			}
			return;
		}
		const pixels = readPixels(state, object);
		const mask = floodSelect(pixels, Math.floor(point.x), Math.floor(point.y), options.tolerance, options.contiguous);
		state.applySelection(mask, operation, object);
	}
}

/**
 * Paint over an area and the selection grows over the pixels of similar color.
 */
export class QuickSelectWorkspaceMode implements WorkspaceMode {
	private painter?: DragPainter;
	private cursor?: BrushCursor;
	private session: QuickSelectSession | null = null;

	public constructor(private readonly state: EditorState) {}

	public init() {
		this.cursor = BrushCursor.create(this.state, () => this.state.quickSelect.size);
		this.painter = DragPainter.create(
			this.state,
			{
				onStart: (point, event) => this.start(point, event),
				onMove: (_start, point) => this.session?.move(point),
				onEnd: () => {
					this.session = null;
				}
			},
			'crosshair',
			false
		);
	}

	public destroy() {
		this.cursor?.destroy();
		this.painter?.destroy();
		this.cursor = undefined;
		this.painter = undefined;
		this.session = null;
	}

	private start(point: Point, event: TPointerEvent): boolean {
		const object = findObjectAt(this.state, point);
		if (!object) {
			return false;
		}
		const operation = resolveOperation(event, this.state.quickSelect.operation);
		this.session = new QuickSelectSession(this.state, object, readPixels(this.state, object), operation);
		this.session.move(point);
		return true;
	}
}

class QuickSelectSession {
	private readonly stroke: Uint8Array;
	private readonly base: SelectionMask | null;
	private last: Point | null = null;

	public constructor(
		private readonly state: EditorState,
		private readonly object: FabricObject,
		private readonly pixels: ImageData,
		private readonly operation: SelectionOperation
	) {
		this.stroke = new Uint8Array(pixels.width * pixels.height);
		this.base = state.getSelection()?.clone() ?? null;
	}

	public move(point: Point) {
		const options = this.state.quickSelect;
		const radius = Math.max(options.size / 2, 1);
		const spacing = Math.max(2, radius / 2);
		let changed = false;
		if (!this.last) {
			changed = quickSelectDab(this.pixels, this.stroke, point.x, point.y, radius, options.tolerance);
		} else {
			const dx = point.x - this.last.x;
			const dy = point.y - this.last.y;
			const distance = Math.hypot(dx, dy);
			const steps = Math.max(1, Math.ceil(distance / spacing));
			for (let i = 1; i <= steps; i++) {
				const t = i / steps;
				changed = quickSelectDab(this.pixels, this.stroke, this.last.x + dx * t, this.last.y + dy * t, radius, options.tolerance) || changed;
			}
		}
		this.last = point;
		if (changed) {
			this.publish();
		}
	}

	private publish() {
		const { width, height } = this.pixels;
		const result = this.operation === 'replace' || !this.base ? SelectionMask.createEmpty(width, height) : this.base.clone();
		result.combine(this.stroke, this.operation === 'replace' ? 'add' : this.operation);
		this.state.replaceSelection(result, this.object);
	}
}
