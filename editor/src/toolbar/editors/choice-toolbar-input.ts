import { Component } from '../../components/component';
import { Html } from '../../core/html';
import { SimpleEvent } from '../../core/simple-event';

export interface ChoiceToolbarInputComponent extends Component {
	readonly onChanged: SimpleEvent<string>;
	setValue(value: string): void;
}

/**
 * A drop-down. `choices` maps the visible label to the value.
 */
export function choiceToolbarInput(labelText: string, choices: Record<string, string>, initialValue: string): ChoiceToolbarInputComponent {
	function onSelectChanged() {
		onChanged.forward(values[select.selectedIndex]);
	}

	const onChanged = new SimpleEvent<string>();

	const label = Html.element('span', {
		class: 'mce-toolbar-label'
	});
	label.textContent = labelText;

	const select = Html.element('select', {
		class: 'mce-toolbar-choice-input'
	});
	const values = Object.values(choices);
	for (const text of Object.keys(choices)) {
		const option = Html.element('option', { value: choices[text] });
		option.text = text;
		select.appendChild(option);
	}
	select.selectedIndex = Math.max(values.indexOf(initialValue), 0);
	select.addEventListener('change', onSelectChanged, false);

	const view = Html.div({
		class: 'mce-toolbar-item'
	});
	view.appendChild(label);
	view.appendChild(select);
	return {
		view,
		onChanged,
		setValue(value: string) {
			select.selectedIndex = Math.max(values.indexOf(value), 0);
		}
	};
}
