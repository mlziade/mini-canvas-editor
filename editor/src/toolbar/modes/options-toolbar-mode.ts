import { Component, DestroyableComponent } from '../../components/component';
import { Html } from '../../core/html';
import { EditorState } from '../../editor-state';
import { buttonToolbarInput, separatorToolbarInput, textToolbarInput } from '../editors/button-toolbar-input';
import { checkboxToolbarInput } from '../editors/checkbox-toolbar-input';
import { choiceToolbarInput } from '../editors/choice-toolbar-input';
import { colorToolbarInput } from '../editors/color-toolbar-input';
import { numberToolbarInput } from '../editors/number-toolbar-input';
import { sliderToolbarInput } from '../editors/slider-toolbar-input';

interface BaseSpec {
	/**
	 * When it returns false the control is hidden. Evaluated again when the selection or any tool option changes.
	 */
	visible?: () => boolean;
}

export type ControlSpec = BaseSpec &
	(
		| { type: 'number'; label: string; get: () => number; set: (value: number) => void; min?: number; max?: number; step?: number }
		| { type: 'slider'; label: string; get: () => number; set: (value: number) => void; min: number; max: number; step?: number; unit?: string }
		| { type: 'color'; label: string; get: () => string; set: (value: string) => void }
		| { type: 'choice'; label: string; choices: Record<string, string>; get: () => string; set: (value: string) => void }
		| { type: 'checkbox'; label: string; get: () => boolean; set: (value: boolean) => void }
		| { type: 'button'; label: string; title?: string; onClick: () => void }
		| { type: 'text'; label: string }
		| { type: 'separator' }
	);

/**
 * A toolbar that is described by a list of controls. Changing a control writes the value
 * back through its `set` function and tells the editor that a tool option changed.
 */
export class OptionsToolbarMode implements DestroyableComponent {
	public static create(state: EditorState, specs: ControlSpec[]): OptionsToolbarMode {
		const view = Html.div({
			class: 'mce-toolbar-options'
		});
		const entries: { component: Component; spec: ControlSpec }[] = [];

		const notify = () => state.onToolOptionsChanged.forward();
		for (const spec of specs) {
			const component = OptionsToolbarMode.createControl(spec, notify);
			view.appendChild(component.view);
			entries.push({ component, spec });
		}

		const toolbar = new OptionsToolbarMode(view, state, entries);
		state.onSelectionChanged.subscribe(toolbar.refreshVisibility);
		state.onToolOptionsChanged.subscribe(toolbar.refreshVisibility);
		toolbar.refreshVisibility();
		return toolbar;
	}

	private static createControl(spec: ControlSpec, notify: () => void): Component {
		switch (spec.type) {
			case 'number': {
				const input = numberToolbarInput(spec.label, spec.get(), spec);
				input.onChanged.subscribe(value => {
					spec.set(value);
					notify();
				});
				return input;
			}
			case 'slider': {
				const input = sliderToolbarInput(spec.label, spec.get(), spec);
				input.onChanged.subscribe(value => {
					spec.set(value);
					notify();
				});
				return input;
			}
			case 'color': {
				const input = colorToolbarInput(spec.label, spec.get());
				input.onChanged.subscribe(value => {
					spec.set(value);
					notify();
				});
				return input;
			}
			case 'choice': {
				const input = choiceToolbarInput(spec.label, spec.choices, spec.get());
				input.onChanged.subscribe(value => {
					spec.set(value);
					notify();
				});
				return input;
			}
			case 'checkbox': {
				const input = checkboxToolbarInput(spec.label, spec.get());
				input.onChanged.subscribe(value => {
					spec.set(value);
					notify();
				});
				return input;
			}
			case 'button': {
				const input = buttonToolbarInput(spec.label, spec.title);
				input.onClicked.subscribe(() => spec.onClick());
				return input;
			}
			case 'text':
				return textToolbarInput(spec.label);
			case 'separator':
				return separatorToolbarInput();
		}
	}

	private constructor(
		public readonly view: HTMLElement,
		private readonly state: EditorState,
		private readonly entries: { component: Component; spec: ControlSpec }[]
	) {}

	private readonly refreshVisibility = () => {
		for (const { component, spec } of this.entries) {
			component.view.classList.toggle('mce-hidden', !!spec.visible && !spec.visible());
			// Keep the controls in step with changes made elsewhere, such as the brush size shortcut.
			if ('get' in spec) {
				(component as unknown as { setValue(value: unknown): void }).setValue(spec.get());
			}
		}
	};

	public destroy() {
		this.state.onSelectionChanged.unsubscribe(this.refreshVisibility);
		this.state.onToolOptionsChanged.unsubscribe(this.refreshVisibility);
	}
}
