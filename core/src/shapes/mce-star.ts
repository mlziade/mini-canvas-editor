import { FabricObject, FabricObjectProps, TOptions, classRegistry } from 'fabric';

export interface MceStarProps extends FabricObjectProps {
	label: string;
	/**
	 * Number of tips (3 or more).
	 */
	points: number;
	/**
	 * Radius of the inner vertices relative to the outer ones. Use 1 for a regular polygon.
	 */
	innerRatio: number;
}

/**
 * A star or a regular polygon that always fills its width and height.
 */
export class MceStar extends FabricObject {
	public static type = 'MceStar';

	public static cacheProperties = [...FabricObject.cacheProperties, 'points', 'innerRatio'];

	public label!: string;
	public points!: number;
	public innerRatio!: number;

	public constructor(options: TOptions<MceStarProps> = {}) {
		super({
			label: 'Star',
			points: 5,
			innerRatio: 0.45,
			fill: '#ff0000',
			stroke: '#ff0000',
			strokeWidth: 0,
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

	/**
	 * Returns the vertices fitted to a box of 1x1 centered on the origin.
	 */
	public getUnitVertices(): { x: number; y: number }[] {
		const count = Math.max(3, Math.round(this.points));
		const ratio = Math.min(Math.max(this.innerRatio, 0.05), 1);
		const vertices: { x: number; y: number }[] = [];
		const total = ratio === 1 ? count : count * 2;
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (let i = 0; i < total; i++) {
			const radius = ratio === 1 || i % 2 === 0 ? 1 : ratio;
			const angle = -Math.PI / 2 + (i * 2 * Math.PI) / total;
			const x = Math.cos(angle) * radius;
			const y = Math.sin(angle) * radius;
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
			vertices.push({ x, y });
		}
		const w = maxX - minX || 1;
		const h = maxY - minY || 1;
		return vertices.map(v => ({ x: (v.x - minX) / w - 0.5, y: (v.y - minY) / h - 0.5 }));
	}

	public _render(ctx: CanvasRenderingContext2D) {
		const vertices = this.getUnitVertices();
		ctx.beginPath();
		vertices.forEach((v, i) => {
			const x = v.x * this.width;
			const y = v.y * this.height;
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});
		ctx.closePath();
		this._renderPaintInOrder(ctx);
	}

	public toObject(propertiesToInclude: string[] = []) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return super.toObject(propertiesToInclude.concat(['label', 'selectable', 'points', 'innerRatio']) as any);
	}
}

classRegistry.setClass(MceStar);
