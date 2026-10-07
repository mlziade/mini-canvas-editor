![Mini Canvas Editor](.github/cover.jpg)

# Mini Canvas Editor

[![Build Status](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fnocode-js%2Fmini-canvas-editor%2Fbadge%3Fref%3Dmain&style=flat-square)](https://actions-badge.atrox.dev/nocode-js/mini-canvas-editor/goto?ref=main) [![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](/LICENSE) [![View this project on NPM](https://img.shields.io/npm/v/mini-canvas-editor.svg?style=flat-square)](https://npmjs.org/package/mini-canvas-editor)

Canvas editor component for JavaScript application. Works with any front-end framework. Easy to integrate and use. Well-known graphical interface. Edit images, draw shapes, add texts and more. Gzipped size less than 100 KB. Uses Fabric.js internally.

Main use cases:

* resize image,
* crop image,
* create a template, render it on the front-end and the back-end (Node.js only),
* create inpainting mask.

Online Examples:

* [🎬 Template Creator](https://nocode-js.github.io/mini-canvas-editor/webpack-app/public/template-creator.html)
* [🎨 Inpainting Mask](https://nocode-js.github.io/mini-canvas-editor/webpack-app/public/inpainting-mask.html)
* [🔲 Crop](https://nocode-js.github.io/mini-canvas-editor/webpack-app/public/crop.html)
* [📦 Vanilla JavaScript](https://nocode-js.github.io/mini-canvas-editor/webpack-app/public/vanilla-javascript.html)

## 🚀 Installation

To use the editor you should add JS/TS files and CSS files to your project.

### NPM

Install this package by [NPM](https://www.npmjs.com/) command:

`npm i mini-canvas-editor`

To import the package:

```ts
import { Editor } from 'mini-canvas-editor';
```

If you use [css-loader](https://webpack.js.org/loaders/css-loader/) or similar, you can add CSS files to your bundle:

```ts
import 'mini-canvas-editor/css/editor.css';
```

To create the editor write the below code:

```ts
Editor.createBlank(placeholder, 200, 300, {});
```

### CDN

Add the below code to your head section in HTML document.

```html
<head>
...
<link href="https://cdn.jsdelivr.net/npm/mini-canvas-editor@0.3.2/css/editor.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/mini-canvas-core@0.3.2/dist/index.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mini-canvas-editor@0.3.2/dist/index.umd.js"></script>
```

Create the editor by:

```js
miniCanvasEditor.Editor.createBlank(placeholder, 200, 300, {});
```

## 🎨 Photo editing tools (this fork)

This fork adds raster tools on top of the original shapes, brush and text:

| Tool | Key | Notes |
|---|---|---|
| Quick selection | Q | Paint over an area and the selection grows over similar colors. |
| Magic wand | W | Click to select similar pixels. Tolerance, contiguous option. Shift adds, Alt subtracts. |
| Shapes | U | Rectangle, ellipse, triangle, star, polygon and line. Shift keeps the sides equal. |
| Arrow | A | Head on one end, both ends or none. Shift snaps to 45 degree steps. |
| Gradient | G | Drag to paint a linear or radial gradient. Fills the selection when there is one. |
| Eraser | E | Soft or hard brush. |
| Clone stamp | S | Alt + click picks the source, then drag to paint a copy. |
| Blur and pixelate | O | Brush, or drag a box. Useful to hide private details. |

With a selection you can delete the pixels, cut or copy them to a new layer, blur or pixelate them, or fill them with a color.
Image layers have filters in the properties panel (brightness, contrast, saturation, hue, noise, blur, pixelate and looks like sepia).
Shapes can have a linear or radial gradient fill.

Undo and redo (`Ctrl+Z`, `Ctrl+Shift+Z`) cover every change. `[` and `]` change the brush size, `Delete` removes the selected pixels or layers and `Ctrl+D` clears the selection.
Turn the shortcuts off with `shortcuts: false`, hide the undo buttons with `history: false`, and disable a tool with `eraser: false`, `clone: false` and so on.

```ts
const editor = Editor.createFromImage(placeholder, image, { fitToWorkspace: true }, { clone: false });
editor.undo();
editor.redo();
editor.setMode(EditorMode.blur);
```

Pixel tools edit the image layer under the pointer. Layers that are not images (shapes, text, paths) are converted to images the first time a pixel tool touches them.
Selections are not part of the undo history. The selection outline is never included in `editor.render()`.

### Installing the fork from tarballs

The fork is not published to npm. Build the two packages as tarballs and install them from files:

```
pnpm install --ignore-scripts --filter ./core --filter ./editor
pnpm run pack:tarballs        # writes tarballs/mini-canvas-core-<version>.tgz and tarballs/mini-canvas-editor-<version>.tgz
```

Then in your project, install both together so the editor finds the matching core:

```
npm install ./vendor/mini-canvas-core-0.4.0.tgz ./vendor/mini-canvas-editor-0.4.0.tgz
```

You can also attach the two files to a GitHub release and install them by URL, for example
`npm install https://github.com/<you>/mini-canvas-editor/releases/download/v0.4.0/mini-canvas-core-0.4.0.tgz <same for the editor>`.
Bump the version in `core/package.json` and `editor/package.json` before packing a new build.

## 💡 License

This project is released under the MIT license.
