import { filters, MceImage } from 'mini-canvas-core';

type Filter = InstanceType<typeof filters.BaseFilter>;
type FilterConstructor = new (options?: object) => Filter;

/**
 * Filters are kept in this order, so the result does not depend on the order the user moved the sliders in.
 */
const ORDER = ['Preset', 'Brightness', 'Contrast', 'Saturation', 'HueRotation', 'Noise', 'Blur', 'Pixelate'];

export const FILTER_PRESETS: Record<string, string> = {
	None: '',
	Grayscale: 'Grayscale',
	'Black and white': 'BlackWhite',
	Sepia: 'Sepia',
	Invert: 'Invert',
	Vintage: 'Vintage',
	Kodachrome: 'Kodachrome',
	Polaroid: 'Polaroid',
	Technicolor: 'Technicolor',
	Brownie: 'Brownie'
};

const PRESET_TYPES = Object.values(FILTER_PRESETS).filter(Boolean);

export interface FilterSlider {
	key: string;
	label: string;
	min: number;
	max: number;
	step: number;
	neutral: number;
	/**
	 * Name of the Fabric filter class.
	 */
	type: string;
	/**
	 * Reads the slider value from the filter.
	 */
	read(filter: Filter): number;
	/**
	 * Creates the filter for the slider value.
	 */
	create(value: number): Filter;
}

function make(type: string, options: object): Filter {
	const FilterClass = (filters as unknown as Record<string, FilterConstructor>)[type];
	return new FilterClass(options);
}

/**
 * The sliders shown for an image layer. Values are in friendly units; the Fabric filters use their own ranges.
 */
export const FILTER_SLIDERS: FilterSlider[] = [
	{
		key: 'brightness',
		label: 'Brightness',
		type: 'Brightness',
		min: -100,
		max: 100,
		step: 1,
		neutral: 0,
		read: f => Math.round((f as unknown as { brightness: number }).brightness * 100),
		create: v => make('Brightness', { brightness: v / 100 })
	},
	{
		key: 'contrast',
		label: 'Contrast',
		type: 'Contrast',
		min: -100,
		max: 100,
		step: 1,
		neutral: 0,
		read: f => Math.round((f as unknown as { contrast: number }).contrast * 100),
		create: v => make('Contrast', { contrast: v / 100 })
	},
	{
		key: 'saturation',
		label: 'Saturation',
		type: 'Saturation',
		min: -100,
		max: 100,
		step: 1,
		neutral: 0,
		read: f => Math.round((f as unknown as { saturation: number }).saturation * 100),
		create: v => make('Saturation', { saturation: v / 100 })
	},
	{
		key: 'hue',
		label: 'Hue',
		type: 'HueRotation',
		min: -180,
		max: 180,
		step: 1,
		neutral: 0,
		read: f => Math.round((f as unknown as { rotation: number }).rotation * 180),
		create: v => make('HueRotation', { rotation: v / 180 })
	},
	{
		key: 'noise',
		label: 'Noise',
		type: 'Noise',
		min: 0,
		max: 200,
		step: 1,
		neutral: 0,
		read: f => (f as unknown as { noise: number }).noise,
		create: v => make('Noise', { noise: v })
	},
	{
		key: 'blur',
		label: 'Blur',
		type: 'Blur',
		min: 0,
		max: 40,
		step: 1,
		neutral: 0,
		read: f => Math.round((f as unknown as { blur: number }).blur * 400),
		create: v => make('Blur', { blur: v / 400 })
	},
	{
		key: 'pixelate',
		label: 'Pixelate',
		type: 'Pixelate',
		min: 1,
		max: 40,
		step: 1,
		neutral: 1,
		read: f => (f as unknown as { blocksize: number }).blocksize,
		create: v => make('Pixelate', { blocksize: v })
	}
];

function typeOf(filter: Filter): string {
	return (filter.constructor as unknown as { type: string }).type;
}

function sortFilters(list: Filter[]): Filter[] {
	const rank = (f: Filter) => {
		const type = typeOf(f);
		return PRESET_TYPES.includes(type) ? 0 : ORDER.indexOf(type);
	};
	return list.slice().sort((a, b) => rank(a) - rank(b));
}

function commit(image: MceImage, list: Filter[]) {
	image.filters = sortFilters(list);
	image.applyFilters();
	image.dirty = true;
}

export function readSlider(image: MceImage, slider: FilterSlider): number {
	const filter = image.filters.find(f => typeOf(f) === slider.type);
	return filter ? slider.read(filter) : slider.neutral;
}

export function writeSlider(image: MceImage, slider: FilterSlider, value: number) {
	const others = image.filters.filter(f => typeOf(f) !== slider.type);
	if (value !== slider.neutral) {
		others.push(slider.create(value));
	}
	commit(image, others);
}

export function readPreset(image: MceImage): string {
	const filter = image.filters.find(f => PRESET_TYPES.includes(typeOf(f)));
	return filter ? typeOf(filter) : '';
}

export function writePreset(image: MceImage, preset: string) {
	const others = image.filters.filter(f => !PRESET_TYPES.includes(typeOf(f)));
	if (preset) {
		others.push(make(preset, {}));
	}
	commit(image, others);
}

export function resetFilters(image: MceImage) {
	commit(image, []);
}
