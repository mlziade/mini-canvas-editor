import { Ellipse, EllipseProps, TOptions, classRegistry } from 'fabric';

export interface MceEllipseProps extends EllipseProps {
	label: string;
}

export class MceEllipse extends Ellipse {
	public label!: string;

	public constructor(options: TOptions<MceEllipseProps> = {}) {
		super({
			fill: '#000000',
			strokeWidth: 0,
			stroke: '#000000',
			label: 'Ellipse',
			rx: 0,
			ry: 0,
			...options
		});
		this.on('scaling', this.onScaled);
	}

	private readonly onScaled = () => {
		const rx = this.rx * this.scaleX;
		const ry = this.ry * this.scaleY;
		this.set({
			rx,
			ry,
			scaleX: 1,
			scaleY: 1
		});
	};

	// @ts-expect-error TS this typing limitations
	public toObject(propertiesToInclude: string[] = []) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return super.toObject(propertiesToInclude.concat(['label', 'selectable']) as any);
	}
}

classRegistry.setClass(MceEllipse);
