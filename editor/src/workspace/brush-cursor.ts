import { Point, TPointerEvent, TPointerEventInfo } from 'mini-canvas-core';
import type { EditorState } from '../editor-state';

/**
 * A circle that follows the pointer and shows how big a brush is.
 * It is drawn on the top canvas, so moving it does not redraw the workspace.
 */
export class BrushCursor {
	public static create(state: EditorState, getDiameter: () => number): BrushCursor {
		const cursor = new BrushCursor(state, getDiameter);
		state.canvas.on('mouse:move', cursor.onMove);
		state.canvas.on('mouse:out', cursor.onOut);
		state.canvas.on('after:render', cursor.onAfterRender);
		return cursor;
	}

	private position: Point | null = null;

	private constructor(
		private readonly state: EditorState,
		private readonly getDiameter: () => number
	) {}

	public destroy() {
		const canvas = this.state.canvas;
		canvas.off('mouse:move', this.onMove);
		canvas.off('mouse:out', this.onOut);
		canvas.off('after:render', this.onAfterRender);
		this.position = null;
		this.redraw();
	}

	private readonly onMove = (o: TPointerEventInfo<TPointerEvent>) => {
		this.position = this.state.canvas.getPointer(o.e, true);
		this.redraw();
	};

	private readonly onOut = () => {
		this.position = null;
		this.redraw();
	};

	private redraw() {
		const canvas = this.state.canvas;
		const top = canvas.contextTop;
		if (!top) {
			return;
		}
		canvas.contextTopDirty = true;
		canvas.renderTop();
	}

	private readonly onAfterRender = (event: { ctx: CanvasRenderingContext2D }) => {
		const canvas = this.state.canvas;
		if (event.ctx !== canvas.contextTop || !this.position) {
			return;
		}
		const radius = (this.getDiameter() / 2) * canvas.getZoom();
		const ctx = event.ctx;
		ctx.save();
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(this.position.x, this.position.y, Math.max(radius, 1), 0, Math.PI * 2);
		ctx.strokeStyle = 'rgba(0,0,0,0.8)';
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(this.position.x, this.position.y, Math.max(radius - 1, 0.5), 0, Math.PI * 2);
		ctx.strokeStyle = 'rgba(255,255,255,0.8)';
		ctx.stroke();
		ctx.restore();
	};
}
