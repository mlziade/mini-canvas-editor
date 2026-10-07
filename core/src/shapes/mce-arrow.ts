import { FabricObject, FabricObjectProps, TOptions, classRegistry } from 'fabric';

export enum MceArrowHead {
	none = 'none',
	end = 'end',
	both = 'both'
}

export interface MceArrowProps extends FabricObjectProps {
	label: string;
	head: MceArrowHead;
	/**
	 * Length of the arrow head, expressed as a multiple of the stroke width.
	 */
	headSize: number;
}

/**
 * A straight line with an optional arrow head on one or both ends.
 *
 * The line always runs from the top-left to the bottom-right corner of the object box.
 * Use `flipX` and `flipY` to point it in the other directions.
 */
export class MceArrow extends FabricObject {
	public static type = 'MceArrow';

	public static cacheProperties = [...FabricObject.cacheProperties, 'head', 'headSize'];

	public label!: string;
	public head!: MceArrowHead;
	public headSize!: number;

	public constructor(options: TOptions<MceArrowProps> = {}) {
		super({
			label: 'Arrow',
			head: MceArrowHead.end,
			headSize: 4,
			stroke: '#ff0000',
			strokeWidth: 4,
			fill: '',
			strokeLineCap: 'round',
			strokeLineJoin: 'round',
			...options
		});
		this.on('scaling', this.onScaled);
	}

	public get type(): string {
		return (this.constructor as typeof FabricObject).type.toLowerCase();
	}

	public set type(_: string) {
		// This override is needed to silent "Setting type has no effect" log.
	}

	private readonly onScaled = () => {
		const width = this.width * this.scaleX;
		const height = this.height * this.scaleY;
		this.set({
			width,
			height,
			scaleX: 1,
			scaleY: 1
		});
	};

	private getHeadLength(): number {
		const length = Math.hypot(this.width, this.height);
		return Math.min(Math.max(this.strokeWidth * this.headSize, 4), Math.max(length * 0.9, 4));
	}

	/**
	 * The arrow head sticks out of the box, so the box has to grow to keep it selectable.
	 */
	public _getNonTransformedDimensions() {
		const dimensions = super._getNonTransformedDimensions();
		const margin = this.head === MceArrowHead.none ? 0 : this.getHeadLength() * 0.6;
		dimensions.x += margin * 2;
		dimensions.y += margin * 2;
		return dimensions;
	}

	public _render(ctx: CanvasRenderingContext2D) {
		if (!this.stroke || !this.strokeWidth) {
			return;
		}
		const x1 = -this.width / 2;
		const y1 = -this.height / 2;
		const x2 = this.width / 2;
		const y2 = this.height / 2;
		const angle = Math.atan2(y2 - y1, x2 - x1);
		const headLength = this.getHeadLength();
		const hasStartHead = this.head === MceArrowHead.both;
		const hasEndHead = this.head === MceArrowHead.end || this.head === MceArrowHead.both;

		// The shaft stops inside the head so a round cap does not poke through the tip.
		const inset = headLength * 0.7;
		const sx = hasStartHead ? x1 + Math.cos(angle) * inset : x1;
		const sy = hasStartHead ? y1 + Math.sin(angle) * inset : y1;
		const ex = hasEndHead ? x2 - Math.cos(angle) * inset : x2;
		const ey = hasEndHead ? y2 - Math.sin(angle) * inset : y2;

		ctx.save();
		const style = typeof this.stroke === 'string' ? this.stroke : this.stroke.toLive(ctx);
		if (style) {
			ctx.strokeStyle = style;
			ctx.fillStyle = style;
		}
		ctx.lineWidth = this.strokeWidth;
		ctx.lineCap = this.strokeLineCap;
		ctx.lineJoin = this.strokeLineJoin;
		if (this.strokeDashArray) {
			ctx.setLineDash(this.strokeDashArray);
		}

		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.lineTo(ex, ey);
		ctx.stroke();

		ctx.setLineDash([]);
		if (hasEndHead) {
			this.drawHead(ctx, x2, y2, angle + Math.PI, headLength);
		}
		if (hasStartHead) {
			this.drawHead(ctx, x1, y1, angle, headLength);
		}
		ctx.restore();
	}

	private drawHead(ctx: CanvasRenderingContext2D, tipX: number, tipY: number, backAngle: number, length: number) {
		const spread = Math.PI / 7;
		ctx.beginPath();
		ctx.moveTo(tipX, tipY);
		ctx.lineTo(tipX + Math.cos(backAngle - spread) * length, tipY + Math.sin(backAngle - spread) * length);
		ctx.lineTo(tipX + Math.cos(backAngle + spread) * length, tipY + Math.sin(backAngle + spread) * length);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}

	public toObject(propertiesToInclude: string[] = []) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return super.toObject(propertiesToInclude.concat(['label', 'selectable', 'head', 'headSize']) as any);
	}
}

classRegistry.setClass(MceArrow);
