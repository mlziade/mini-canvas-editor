/**
 * Largest per-channel difference between two RGBA pixels (0-255).
 */
export function colorDistance(pixels: Uint8ClampedArray, offset: number, r: number, g: number, b: number, a: number): number {
	const dr = Math.abs(pixels[offset] - r);
	const dg = Math.abs(pixels[offset + 1] - g);
	const db = Math.abs(pixels[offset + 2] - b);
	const da = Math.abs(pixels[offset + 3] - a);
	return Math.max(dr, dg, db, da);
}

/**
 * Selects the pixels that look like the pixel at (x, y).
 * Returns a mask with 255 for selected pixels. With `contiguous` only the connected area is selected.
 */
export function floodSelect(image: ImageData, x: number, y: number, tolerance: number, contiguous: boolean): Uint8Array {
	const { width, height, data } = image;
	const mask = new Uint8Array(width * height);
	if (x < 0 || y < 0 || x >= width || y >= height) {
		return mask;
	}
	const seed = (y * width + x) * 4;
	const r = data[seed];
	const g = data[seed + 1];
	const b = data[seed + 2];
	const a = data[seed + 3];

	if (!contiguous) {
		for (let i = 0; i < width * height; i++) {
			if (colorDistance(data, i * 4, r, g, b, a) <= tolerance) {
				mask[i] = 255;
			}
		}
		return mask;
	}

	const matches = (px: number, py: number) => !mask[py * width + px] && colorDistance(data, (py * width + px) * 4, r, g, b, a) <= tolerance;

	// Scanline fill: far fewer stack entries than pushing every pixel.
	const stack: number[] = [x, y];
	while (stack.length > 0) {
		const sy = stack.pop() as number;
		const sx = stack.pop() as number;
		if (!matches(sx, sy)) {
			continue;
		}
		let left = sx;
		while (left > 0 && matches(left - 1, sy)) {
			left--;
		}
		let right = sx;
		while (right < width - 1 && matches(right + 1, sy)) {
			right++;
		}
		mask.fill(255, sy * width + left, sy * width + right + 1);

		for (const ny of [sy - 1, sy + 1]) {
			if (ny < 0 || ny >= height) {
				continue;
			}
			let inRun = false;
			for (let px = left; px <= right; px++) {
				if (matches(px, ny)) {
					if (!inRun) {
						stack.push(px, ny);
						inRun = true;
					}
				} else {
					inRun = false;
				}
			}
		}
	}
	return mask;
}

/**
 * One step of the quick selection brush: grows the selection around (cx, cy) over the pixels
 * that are similar to the color under the brush, without leaving the brush circle.
 * Writes 255 into `mask` and returns true when it changed anything.
 */
export function quickSelectDab(image: ImageData, mask: Uint8Array, cx: number, cy: number, radius: number, tolerance: number): boolean {
	const { width, height, data } = image;
	const centerX = Math.round(cx);
	const centerY = Math.round(cy);
	if (centerX < 0 || centerY < 0 || centerX >= width || centerY >= height) {
		return false;
	}

	// The seed color is the mean of a small neighborhood, so noise does not decide the selection.
	let sr = 0;
	let sg = 0;
	let sb = 0;
	let sa = 0;
	let samples = 0;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			const px = centerX + dx;
			const py = centerY + dy;
			if (px < 0 || py < 0 || px >= width || py >= height) {
				continue;
			}
			const o = (py * width + px) * 4;
			sr += data[o];
			sg += data[o + 1];
			sb += data[o + 2];
			sa += data[o + 3];
			samples++;
		}
	}
	sr /= samples;
	sg /= samples;
	sb /= samples;
	sa /= samples;

	const r2 = radius * radius;
	// Only the window around the brush needs a visited flag.
	const reach = Math.ceil(radius) + 1;
	const windowSize = reach * 2 + 1;
	const visited = new Uint8Array(windowSize * windowSize);
	const stack: number[] = [centerX, centerY];
	let changed = false;
	while (stack.length > 0) {
		const y = stack.pop() as number;
		const x = stack.pop() as number;
		if (x < 0 || y < 0 || x >= width || y >= height) {
			continue;
		}
		const wx = x - centerX + reach;
		const wy = y - centerY + reach;
		if (wx < 0 || wy < 0 || wx >= windowSize || wy >= windowSize) {
			continue;
		}
		if (visited[wy * windowSize + wx]) {
			continue;
		}
		visited[wy * windowSize + wx] = 1;
		const index = y * width + x;
		const dx = x - cx;
		const dy = y - cy;
		if (dx * dx + dy * dy > r2) {
			continue;
		}
		if (colorDistance(data, index * 4, sr, sg, sb, sa) > tolerance) {
			continue;
		}
		if (!mask[index]) {
			mask[index] = 255;
			changed = true;
		}
		stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
	}
	return changed;
}
