import { floodSelect, quickSelectDab } from './flood-fill';
import { pixelateImageData } from './effects';
import { SelectionMask } from './selection-mask';

function createImage(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const [r, g, b, a] = paint(x, y);
			const o = (y * width + x) * 4;
			data[o] = r;
			data[o + 1] = g;
			data[o + 2] = b;
			data[o + 3] = a;
		}
	}
	return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

function count(mask: Uint8Array): number {
	return mask.reduce((sum, v) => sum + (v ? 1 : 0), 0);
}

describe('floodSelect', () => {
	// Left half red, right half blue, with a red square inside the blue half.
	const image = createImage(10, 10, (x, y) => {
		if (x < 5) return [255, 0, 0, 255];
		if (x >= 7 && x < 9 && y >= 2 && y < 4) return [255, 0, 0, 255];
		return [0, 0, 255, 255];
	});

	it('selects the connected area of the same color', () => {
		const mask = floodSelect(image, 0, 0, 0, true);
		expect(count(mask)).toBe(50);
		expect(mask[5]).toBe(0);
	});

	it('also selects separate areas when not contiguous', () => {
		const mask = floodSelect(image, 0, 0, 0, false);
		expect(count(mask)).toBe(50 + 4);
	});

	it('uses the tolerance', () => {
		const soft = createImage(4, 1, x => [100 + x * 10, 0, 0, 255]);
		expect(count(floodSelect(soft, 0, 0, 5, true))).toBe(1);
		expect(count(floodSelect(soft, 0, 0, 10, true))).toBe(2);
		expect(count(floodSelect(soft, 0, 0, 30, true))).toBe(4);
	});

	it('returns nothing outside of the image', () => {
		expect(count(floodSelect(image, -1, 0, 10, true))).toBe(0);
		expect(count(floodSelect(image, 0, 99, 10, true))).toBe(0);
	});
});

describe('quickSelectDab', () => {
	const image = createImage(40, 20, x => (x < 20 ? [255, 255, 255, 255] : [0, 0, 0, 255]));

	it('grows over similar pixels inside the brush', () => {
		const mask = new Uint8Array(40 * 20);
		expect(quickSelectDab(image, mask, 10, 10, 6, 20)).toBe(true);
		expect(mask[10 * 40 + 10]).toBe(255);
		expect(mask[10 * 40 + 14]).toBe(255);
		expect(mask[10 * 40 + 20]).toBe(0);
	});

	it('does not cross an edge with a different color', () => {
		const mask = new Uint8Array(40 * 20);
		quickSelectDab(image, mask, 17, 10, 10, 20);
		expect(mask[10 * 40 + 19]).toBe(255);
		expect(mask[10 * 40 + 20]).toBe(0);
		expect(mask[10 * 40 + 22]).toBe(0);
	});
});

describe('SelectionMask', () => {
	it('combines masks', () => {
		const a = SelectionMask.createRect(10, 10, { x: 0, y: 0, width: 5, height: 10 });
		const b = SelectionMask.createRect(10, 10, { x: 3, y: 0, width: 5, height: 10 });

		const union = a.clone();
		union.combine(b.data, 'add');
		expect(union.getBounds()).toEqual({ x: 0, y: 0, width: 8, height: 10 });

		const minus = a.clone();
		minus.combine(b.data, 'subtract');
		expect(minus.getBounds()).toEqual({ x: 0, y: 0, width: 3, height: 10 });

		const both = a.clone();
		both.combine(b.data, 'intersect');
		expect(both.getBounds()).toEqual({ x: 3, y: 0, width: 2, height: 10 });

		const replaced = a.clone();
		replaced.combine(b.data, 'replace');
		expect(replaced.getBounds()).toEqual({ x: 3, y: 0, width: 5, height: 10 });
	});

	it('inverts and detects emptiness', () => {
		const mask = SelectionMask.createEmpty(4, 4);
		expect(mask.isEmpty()).toBe(true);
		mask.invert();
		expect(mask.isEmpty()).toBe(false);
		expect(mask.getBounds()).toEqual({ x: 0, y: 0, width: 4, height: 4 });
		mask.clear();
		expect(mask.isEmpty()).toBe(true);
	});

	it('refreshes the cached bounds when it changes', () => {
		const mask = SelectionMask.createRect(10, 10, { x: 2, y: 2, width: 2, height: 2 });
		expect(mask.getBounds()).toEqual({ x: 2, y: 2, width: 2, height: 2 });
		mask.data[0] = 255;
		mask.touch();
		expect(mask.getBounds()).toEqual({ x: 0, y: 0, width: 4, height: 4 });
	});
});

describe('pixelateImageData', () => {
	it('averages every block', () => {
		const image = createImage(4, 2, x => (x % 2 === 0 ? [0, 0, 0, 255] : [100, 200, 40, 255]));
		pixelateImageData(image, 2);
		expect(Array.from(image.data.slice(0, 4))).toEqual([50, 100, 20, 255]);
		expect(Array.from(image.data.slice(4, 8))).toEqual([50, 100, 20, 255]);
	});

	it('keeps partial blocks at the edges', () => {
		const image = createImage(3, 1, x => [x * 100, 0, 0, 255]);
		pixelateImageData(image, 2);
		expect(image.data[0]).toBe(50);
		expect(image.data[8]).toBe(200);
	});

	it('does nothing for a block size of one', () => {
		const image = createImage(2, 1, x => [x * 100, 0, 0, 255]);
		pixelateImageData(image, 1);
		expect(image.data[4]).toBe(100);
	});
});
