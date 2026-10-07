import { Point, TPointerEvent, TPointerEventInfo } from 'mini-canvas-core';
import type { EditorState, SelectionReverter } from '../../editor-state';
import type { RasterPatch } from '../../raster/raster-layer';

export interface DragHandlers {
	/**
	 * Called when the pointer goes down. Return false to ignore this drag.
	 */
	onStart(point: Point, event: TPointerEvent): boolean | void;
	onMove(start: Point, point: Point, event: TPointerEvent): void;
	/**
	 * Return the pixel patches the gesture made, so they can be undone.
	 */
	onEnd(start: Point, point: Point, event: TPointerEvent): RasterPatch[] | void;
	/**
	 * Called for pointer moves while the button is up.
	 */
	onHover?(point: Point, event: TPointerEvent): void;
}

/**
 * Turns pointer events on the canvas into drag gestures, with the objects made unselectable meanwhile.
 */
export class DragPainter {
	/**
	 * With `recordHistory` everything done between the pointer going down and up becomes one undo step.
	 */
	public static create(state: EditorState, handlers: DragHandlers, cursor = 'crosshair', recordHistory = true): DragPainter {
		const selectionReverter = state.disableSelection();
		const painter = new DragPainter(state, selectionReverter, handlers, recordHistory);
		state.canvas.on('mouse:down', painter.onDown);
		state.canvas.on('mouse:move', painter.onMove);
		state.canvas.on('mouse:up', painter.onUp);
		state.canvas.discardActiveObject();
		state.canvas.setCursor(cursor);
		state.canvas.defaultCursor = cursor;
		state.canvas.hoverCursor = cursor;
		return painter;
	}

	private start: Point | null = null;
	private endHistory: ((patches: RasterPatch[]) => void) | null = null;
	private readonly originalCursors: { defaultCursor: string; hoverCursor: string };

	private constructor(
		private readonly state: EditorState,
		private readonly selectionReverter: SelectionReverter,
		private readonly handlers: DragHandlers,
		private readonly recordHistory: boolean
	) {
		this.originalCursors = {
			defaultCursor: state.canvas.defaultCursor,
			hoverCursor: state.canvas.hoverCursor
		};
	}

	public destroy() {
		this.state.canvas.off('mouse:down', this.onDown);
		this.state.canvas.off('mouse:move', this.onMove);
		this.state.canvas.off('mouse:up', this.onUp);
		this.selectionReverter.revert();
		this.endHistory?.([]);
		this.endHistory = null;
		this.start = null;
		this.state.canvas.defaultCursor = this.originalCursors.defaultCursor;
		this.state.canvas.hoverCursor = this.originalCursors.hoverCursor;
	}

	private readonly onDown = (o: TPointerEventInfo<TPointerEvent>) => {
		o.e.preventDefault();
		o.e.stopPropagation();
		const point = this.state.canvas.getPointer(o.e);
		let endHistory: ((patches: RasterPatch[]) => void) | null = null;
		if (this.recordHistory) {
			const history = this.state.history;
			const before = history.begin();
			endHistory = patches => history.end(before, patches);
		}
		if (this.handlers.onStart(point, o.e) === false) {
			endHistory?.([]);
			return;
		}
		this.endHistory = endHistory;
		this.start = point;
	};

	private readonly onMove = (o: TPointerEventInfo<TPointerEvent>) => {
		const point = this.state.canvas.getPointer(o.e);
		if (!this.start) {
			this.handlers.onHover?.(point, o.e);
			return;
		}
		this.handlers.onMove(this.start, point, o.e);
	};

	private readonly onUp = (o: TPointerEventInfo<TPointerEvent>) => {
		if (!this.start) {
			return;
		}
		const start = this.start;
		this.start = null;
		let patches: RasterPatch[] = [];
		try {
			patches = this.handlers.onEnd(start, this.state.canvas.getPointer(o.e), o.e) || [];
		} finally {
			const end = this.endHistory;
			this.endHistory = null;
			end?.(patches);
		}
	};
}
