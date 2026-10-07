import { FabricObjectProps, Triangle, TOptions, classRegistry } from 'fabric';

export interface MceTriangleProps extends FabricObjectProps {
	label: string;
}

export class MceTriangle extends Triangle {
	public label!: string;

	public constructor(options: TOptions<MceTriangleProps> = {}) {
		super({
			fill: '#000000',
			strokeWidth: 0,
			stroke: '#000000',
			label: 'Triangle',
			...options
		});
		this.on('scaling', this.onScaled);
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

	public toObject(propertiesToInclude: string[] = []) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return super.toObject(propertiesToInclude.concat(['label', 'selectable']) as any);
	}
}

classRegistry.setClass(MceTriangle);
