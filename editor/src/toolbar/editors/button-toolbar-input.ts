import { Component } from '../../components/component';
import { Html } from '../../core/html';
import { SimpleEvent } from '../../core/simple-event';

export interface ButtonToolbarInputComponent extends Component {
	readonly onClicked: SimpleEvent<void>;
}

export function buttonToolbarInput(text: string, title?: string): ButtonToolbarInputComponent {
	const onClicked = new SimpleEvent<void>();

	const button = Html.element('button', {
		class: 'mce-toolbar-button',
		type: 'button'
	});
	button.textContent = text;
	if (title) {
		button.title = title;
	}
	button.addEventListener(
		'click',
		e => {
			e.preventDefault();
			onClicked.forward();
		},
		false
	);

	const view = Html.div({
		class: 'mce-toolbar-item'
	});
	view.appendChild(button);
	return { view, onClicked };
}

export function textToolbarInput(text: string): Component {
	const view = Html.div({
		class: 'mce-toolbar-item mce-toolbar-hint'
	});
	view.textContent = text;
	return { view };
}

export function separatorToolbarInput(): Component {
	return { view: Html.div({ class: 'mce-toolbar-item mce-toolbar-separator' }) };
}
