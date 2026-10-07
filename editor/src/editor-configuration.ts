import { MceArrowHead } from 'mini-canvas-core';
import type { SelectionOperation } from './raster/selection-mask';

export interface EditorConfiguration {
	initialMode?: EditorMode;
	rect?: RectModeConfiguration | false;
	brush?: BrushModeConfiguration | false;
	textbox?: TextboxModeConfiguration | false;
	image?: ImageModeConfiguration | false;
	arrow?: ArrowModeConfiguration | false;
	shape?: ShapeModeConfiguration | false;
	eraser?: EraserModeConfiguration | false;
	clone?: CloneModeConfiguration | false;
	blur?: BlurModeConfiguration | false;
	magicWand?: MagicWandModeConfiguration | false;
	quickSelect?: QuickSelectModeConfiguration | false;
	gradient?: GradientModeConfiguration | false;
	sidebar?: SidebarConfiguration | boolean;
	/**
	 * Whether to show the undo and redo buttons.
	 * @default true
	 */
	history?: boolean;
	/**
	 * Whether the editor listens to keyboard shortcuts (tools, undo, redo, delete).
	 * @default true
	 */
	shortcuts?: boolean;
}

export interface SidebarConfiguration {
	/**
	 * Whether to show the properties panel.
	 * @default true
	 */
	properties?: boolean;

	/**
	 * Whether to show the layers panel.
	 * @default true
	 */
	layers?: boolean;
}

export interface RectModeConfiguration {
	fillColor?: string;
}

export interface BrushModeConfiguration {
	brushSize?: number;
	brushColor?: string;
}

export interface TextboxModeConfiguration {}

export interface ImageModeConfiguration {}

export interface ArrowModeConfiguration {
	color?: string;
	width?: number;
	head?: MceArrowHead;
}

export type ShapeType = 'rect' | 'ellipse' | 'triangle' | 'star' | 'polygon' | 'line';

export interface ShapeModeConfiguration {
	type?: ShapeType;
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
}

export interface EraserModeConfiguration {
	size?: number;
	hardness?: number;
	opacity?: number;
}

export interface CloneModeConfiguration {
	size?: number;
	hardness?: number;
	opacity?: number;
	/**
	 * Keep the offset to the source between strokes.
	 */
	aligned?: boolean;
}

export type BlurShape = 'brush' | 'area';
export type BlurEffect = 'blur' | 'pixelate';

export interface BlurModeConfiguration {
	shape?: BlurShape;
	effect?: BlurEffect;
	size?: number;
	strength?: number;
	hardness?: number;
}

export interface MagicWandModeConfiguration {
	tolerance?: number;
	contiguous?: boolean;
	operation?: SelectionOperation;
}

export interface QuickSelectModeConfiguration {
	size?: number;
	tolerance?: number;
	operation?: SelectionOperation;
}

export type GradientType = 'linear' | 'radial';

export interface GradientModeConfiguration {
	type?: GradientType;
	fromColor?: string;
	toColor?: string;
}

export enum EditorMode {
	select = 'select',
	rect = 'rect',
	brush = 'brush',
	textbox = 'textbox',
	arrow = 'arrow',
	shape = 'shape',
	eraser = 'eraser',
	clone = 'clone',
	blur = 'blur',
	magicWand = 'magicWand',
	quickSelect = 'quickSelect',
	gradient = 'gradient'
}
