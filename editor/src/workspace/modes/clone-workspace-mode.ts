import { Point } from 'mini-canvas-core';
import type { EditorState } from '../../editor-state';
import { RasterLayer } from '../../raster/raster-layer';
import { RasterBrushMode } from './raster-brush-mode';
import { WorkspaceMode } from './workspace-mode';

/**
 * Clone stamp. Alt + click picks the point to copy from, then dragging paints a copy of it.
 */
export class CloneWorkspaceMode implements WorkspaceMode {
	private readonly brush: RasterBrushMode;
	private offset: { x: number; y: number } | null = null;

	public constructor(private readonly state: EditorState) {
		this.brush = new RasterBrushMode(state, {
			kind: 'clone',
			getOptions: () => ({ ...state.clone }),
			shouldStart: event => !(event as MouseEvent).altKey && !!state.cloneSource,
			onPointerDown: (point, _event, layer) => this.onPointerDown(point, layer),
			getCloneOffset: () => this.offset ?? undefined
		});
	}

	public init() {
		this.brush.init();
		this.state.canvas.on('after:render', this.drawSource);
		this.state.canvas.on('mouse:down:before', this.onMouseDownBefore);
	}

	public destroy() {
		this.state.canvas.off('after:render', this.drawSource);
		this.state.canvas.off('mouse:down:before', this.onMouseDownBefore);
		this.brush.destroy();
		this.state.cloneSource = null;
		this.state.canvas.requestRenderAll();
	}

	/**
	 * Alt + click only picks the source, so it must not start a stroke.
	 */
	private readonly onMouseDownBefore = (o: { e: Event }) => {
		const event = o.e as MouseEvent;
		if (event.altKey) {
			this.state.cloneSource = this.state.canvas.getPointer(event);
			this.offset = null;
			this.state.canvas.requestRenderAll();
		}
	};

	private onPointerDown(point: Point, layer: RasterLayer): boolean {
		if (!this.state.cloneSource) {
			return false;
		}
		if (!this.offset || !this.state.clone.aligned) {
			const source = layer.worldToLocal(this.state.cloneSource);
			const start = layer.worldToLocal(point);
			this.offset = { x: source.x - start.x, y: source.y - start.y };
		}
		return true;
	}

	private readonly drawSource = (event: { ctx: CanvasRenderingContext2D }) => {
		const canvas = this.state.canvas;
		const source = this.state.cloneSource;
		if (!source || event.ctx !== canvas.getContext()) {
			return;
		}
		const v = canvas.viewportTransform;
		const x = source.x * v[0] + v[4];
		const y = source.y * v[3] + v[5];
		const ctx = event.ctx;
		const radius = (this.state.clone.size / 2) * canvas.getZoom();
		ctx.save();
		ctx.lineWidth = 1;
		for (const [color, grow] of [['#000', 0], ['#fff', 1]] as const) {
			ctx.strokeStyle = color;
			ctx.beginPath();
			ctx.arc(x, y, radius + grow, 0, Math.PI * 2);
			ctx.moveTo(x - 6, y);
			ctx.lineTo(x + 6, y);
			ctx.moveTo(x, y - 6);
			ctx.lineTo(x, y + 6);
			ctx.stroke();
		}
		ctx.restore();
	};
}
