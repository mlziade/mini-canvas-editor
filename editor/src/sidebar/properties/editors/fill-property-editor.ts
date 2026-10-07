import { FabricObject, Gradient, TFiller } from 'mini-canvas-core';
import { DestroyableComponent } from '../../../components/component';
import { Html } from '../../../core/html';
import { simplePropertyEditor } from './simple-property-editor';
import { propertyEditorRow } from '../layout/property-editor-row';
import { propertyEditorRows } from '../layout/property-editor-rows';
import { UpdateManager } from '../update-manager';
import { FillType } from './color-property-editor';

type FillKind = 'solid' | 'linear' | 'radial';

interface FillModel {
	kind: FillKind;
	from: string;
	to: string;
	angle: number;
}

const DEFAULT_TO = '#0000ff';

function toHex(color: string | undefined, fallback: string): string {
	if (!color) {
		return fallback;
	}
	if (/^#[0-9a-f]{6}$/i.test(color)) {
		return color.toLowerCase();
	}
	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
	if (short) {
		return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
	}
	const rgb = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(color);
	if (rgb) {
		return '#' + [rgb[1], rgb[2], rgb[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('');
	}
	return fallback;
}

function readFill(fill: FillType): FillModel {
	if (fill instanceof Gradient) {
		const stops = fill.colorStops;
		const coords = fill.coords as { x1: number; y1: number; x2: number; y2: number };
		const angle = fill.type === 'linear' ? (Math.atan2(coords.y2 - coords.y1, coords.x2 - coords.x1) * 180) / Math.PI : 0;
		return {
			kind: fill.type === 'radial' ? 'radial' : 'linear',
			from: toHex(stops[0]?.color, '#000000'),
			to: toHex(stops[stops.length - 1]?.color, DEFAULT_TO),
			angle: Math.round(angle)
		};
	}
	return { kind: 'solid', from: toHex(typeof fill === 'string' ? fill : undefined, '#000000'), to: DEFAULT_TO, angle: 0 };
}

/**
 * Builds a gradient that stretches over the whole object, whatever its size.
 */
export function createFillFromModel(model: FillModel): string | TFiller {
	if (model.kind === 'solid') {
		return model.from;
	}
	const colorStops = [
		{ offset: 0, color: model.from },
		{ offset: 1, color: model.to }
	];
	if (model.kind === 'radial') {
		return new Gradient({
			type: 'radial',
			gradientUnits: 'percentage',
			coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
			colorStops
		} as unknown as ConstructorParameters<typeof Gradient>[0]) as unknown as TFiller;
	}
	const radians = (model.angle * Math.PI) / 180;
	const dx = Math.cos(radians) / 2;
	const dy = Math.sin(radians) / 2;
	return new Gradient({
		type: 'linear',
		gradientUnits: 'percentage',
		coords: { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy },
		colorStops
	} as unknown as ConstructorParameters<typeof Gradient>[0]) as unknown as TFiller;
}

/**
 * Edits the fill of a shape: a solid color, or a linear or radial gradient between two colors.
 */
export function fillPropertyEditor(manager: UpdateManager<FabricObject>, label = 'Fill'): DestroyableComponent {
	const fillAccessor = manager.bind(
		o => o.fill as FillType,
		(o, v) => o.set('fill', v as never)
	);
	const model = readFill(fillAccessor.getValue());

	function apply() {
		fillAccessor.setValue(createFillFromModel(model));
		refresh();
	}

	function refresh() {
		const gradient = model.kind !== 'solid';
		toRow.view.classList.toggle('mce-hidden', !gradient);
		angleRow.view.classList.toggle('mce-hidden', model.kind !== 'linear');
		fromInput.value = model.from;
		toInput.value = model.to;
		angleInput.value = String(model.angle);
		kindSelect.value = model.kind;
		fromLabel.textContent = gradient ? 'From' : 'Color';
	}

	const kindSelect = Html.element('select', { class: 'mce-prop-choice' });
	for (const [text, value] of [
		['Solid', 'solid'],
		['Linear gradient', 'linear'],
		['Radial gradient', 'radial']
	]) {
		const option = Html.element('option', { value });
		option.text = text;
		kindSelect.appendChild(option);
	}
	kindSelect.addEventListener(
		'change',
		() => {
			model.kind = kindSelect.value as FillKind;
			apply();
		},
		false
	);

	const fromInput = Html.element('input', { class: 'mce-prop-color-input', type: 'color' });
	fromInput.addEventListener(
		'input',
		() => {
			model.from = fromInput.value;
			apply();
		},
		false
	);
	const toInput = Html.element('input', { class: 'mce-prop-color-input', type: 'color' });
	toInput.addEventListener(
		'input',
		() => {
			model.to = toInput.value;
			apply();
		},
		false
	);
	const angleInput = Html.element('input', { class: 'mce-prop-number-input', type: 'number', step: '5' });
	angleInput.addEventListener(
		'input',
		() => {
			model.angle = Number(angleInput.value);
			apply();
		},
		false
	);

	const kindRow = propertyEditorRow([{ view: simplePropertyEditor(label, kindSelect).view, destroy: noop }]);
	const fromEditor = simplePropertyEditor('Color', fromInput);
	const fromLabel = fromEditor.view.querySelector('.mce-prop-simple-label') as HTMLElement;
	const fromRow = propertyEditorRow([{ view: fromEditor.view, destroy: noop }]);
	const toRow = propertyEditorRow([{ view: simplePropertyEditor('To', toInput).view, destroy: noop }]);
	const angleRow = propertyEditorRow([{ view: simplePropertyEditor('Angle', angleInput).view, destroy: noop }]);
	refresh();

	return propertyEditorRows([kindRow, fromRow, toRow, angleRow]);
}

function noop() {
	//
}
