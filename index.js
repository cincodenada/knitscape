import { html, render } from "lit-html";
import { live } from "lit-html/directives/live.js";

import { Bimp } from "./bimp/Bimp";

import { buildRepeatEditor } from "./editors/repeatEditor";
import { buildColorChangeEditor } from "./editors/colorChangeEditor";
import { buildNeedleEditor } from "./editors/needleEditor";
import { buildPreview } from "./editors/previewEditor";

import { download, makeBMP } from "./utils";

import { simulate } from "./simulation/yarnSimulation";

import startState from "./patterns/debug.json";

const library = import.meta.glob("/patterns/*.json");

let repeatEditor, colorChangeEditor, needleEditor, preview;

let clear, relax, flip;

let GLOBAL_STATE = {
  // scale: 25,
  scale: 75,
  updateSim: false,
  simWidth: 8,
  simHeight: 8,
};

function loadWorkspace(workspace) {
  GLOBAL_STATE = { ...GLOBAL_STATE, ...workspace };
  GLOBAL_STATE.updateSim = true;
}

function downloadSVG() {
  var svg = document.getElementById("simulation");

  //get svg source.
  var serializer = new XMLSerializer();
  var source = serializer.serializeToString(svg);

  //add name spaces.
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(
      /^<svg/,
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"'
    );
  }

  //add xml declaration
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

  download(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source),
    "swatch.svg"
  );
}

function downloadPNG() {
  download(
    document.getElementById("preview").toDataURL("image/png"),
    "chart.png"
  );
}

function downloadBMP() {
  download(
    makeBMP(
      repeatEditor.state.bitmap,
      colorChangeEditor.state.bitmap.pixels,
      colorChangeEditor.state.palette
    ).src
  );
}

function downloadSilverKnitTxt() {
  const text =
    "SilverKnit\n" +
    repeatEditor.state.bitmap
      .make2d()
      .map((row) =>
        row
          .map((pixel) => {
            if (pixel == 0 || pixel == 1) return 7;
            else return 8;
          })
          .join("")
      )
      .join("\n");

  download(
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
    "pattern.txt"
  );
}

function downloadJSON() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(
      JSON.stringify({
        yarnPalette: GLOBAL_STATE.yarnPalette,
        needles: needleEditor.state.bitmap.toJSON(),
        repeat: repeatEditor.state.bitmap.toJSON(),
        yarns: colorChangeEditor.state.bitmap.vMirror().toJSON(),
      })
    );

  download(dataStr, "pattern.json");
}

function doLoad(e) {
  let file = e.target.files[0];
  const fileReader = new FileReader();
  fileReader.readAsText(file);
  fileReader.onload = () => {
    loadJSON(JSON.parse(fileReader.result));
  };
}

function upload() {
  let fileInputElement = document.createElement("input");

  fileInputElement.setAttribute("type", "file");
  fileInputElement.style.display = "none";

  document.body.appendChild(fileInputElement);
  fileInputElement.click();
  fileInputElement.onchange = doLoad;
  document.body.removeChild(fileInputElement);
}

function loadJSON(patternJSON) {
  loadWorkspace(patternJSON);
  syncScale();
  regenPreview();

  repeatEditor.dispatch({ bitmap: Bimp.fromJSON(patternJSON.repeat) });
  needleEditor.dispatch({ bitmap: Bimp.fromJSON(patternJSON.needles) });
  colorChangeEditor.dispatch({
    bitmap: Bimp.fromJSON(patternJSON.yarns).vMirror(),
  });

  colorChangeEditor.dispatch({ palette: patternJSON.yarnPalette });

  colorChangeEditor.dispatch({ scale });
  needleEditor.dispatch({ scale });
  preview.dispatch({ scale });

  GLOBAL_STATE.updateSim = true;
}

function load(path) {
  library[path]().then((mod) => loadJSON(mod));
}

function widthSpinner() {
  return html`<div class="spinner horizontal">
    <button
      class="minus"
      @click=${() => {
        GLOBAL_STATE.simWidth = GLOBAL_STATE.simWidth - 1;
        GLOBAL_STATE.updateSim = true;
      }}>
      <i class="fa-solid fa-minus"></i>
    </button>
    <input
      type="text"
      .value=${live(GLOBAL_STATE.simWidth.toString())}
      class="size-input"
      @change=${(e) => {
        GLOBAL_STATE.simWidth = Number(e.target.value);
        GLOBAL_STATE.updateSim = true;
      }} />
    <button
      class="plus"
      @click=${() => {
        GLOBAL_STATE.simWidth = GLOBAL_STATE.simWidth + 1;
        GLOBAL_STATE.updateSim = true;
      }}>
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>`;
}

function heightSpinner() {
  return html`<div class="spinner horizontal">
    <button
      class="minus"
      @click=${() => {
        GLOBAL_STATE.simHeight = GLOBAL_STATE.simHeight - 1;
        GLOBAL_STATE.updateSim = true;
      }}>
      <i class="fa-solid fa-minus"></i>
    </button>
    <input
      type="text"
      .value=${live(GLOBAL_STATE.simHeight.toString())}
      class="size-input"
      @change=${(e) => {
        GLOBAL_STATE.simHeight = Number(e.target.value);
        GLOBAL_STATE.updateSim = true;
      }} />
    <button
      class="plus"
      @click=${() => {
        GLOBAL_STATE.simHeight = GLOBAL_STATE.simHeight + 1;
        GLOBAL_STATE.updateSim = true;
      }}>
      <i class="fa-solid fa-plus"></i>
    </button>
  </div>`;
}

function view() {
  return html`
    <div id="site-content">
      <div id="site-title" style="grid-area: title;">
        <span>knitscape</span>
      </div>
      <div id="left-controls" style="grid-area: lcontrols;">
        <button @click=${upload}><i class="fa-solid fa-upload"></i></button>

        <div class="dropdown-container">
          <i class="fa-solid fa-download"></i>
          <div class="dropdown">
            <div @click=${() => downloadJSON()}>Pattern JSON</div>
            <div @click=${() => downloadPNG()}>Chart PNG</div>
            <div @click=${() => downloadSVG()}>Simulation SVG</div>
            <div @click=${() => downloadBMP()}>Windows BMP (Silver Knit)</div>
            <div @click=${() => downloadSilverKnitTxt()}>TXT (Silver Knit)</div>
          </div>
        </div>
        <div class="dropdown-container">
          <i class="fa-solid fa-book"></i>
          <div class="dropdown">
            ${Object.entries(library).map(
              ([path, _]) =>
                html`<div class="dropdown-item ex" @click=${() => load(path)}>
                  ${path.split("/").at(-1).split(".")[0]}
                </div>`
            )}
          </div>
        </div>
        <button
          @click=${() => {
            GLOBAL_STATE.scale =
              GLOBAL_STATE.scale + devicePixelRatio / (devicePixelRatio - 1);
            syncScale();
          }}>
          <i class="fa-solid fa-magnifying-glass-plus"></i>
        </button>
        <button
          @click=${() => {
            GLOBAL_STATE.scale =
              GLOBAL_STATE.scale - devicePixelRatio / (devicePixelRatio - 1);
            syncScale();
          }}>
          <i class="fa-solid fa-magnifying-glass-minus"></i>
        </button>
        <div id="repeat-tools"></div>
        <div id="repeat-palette"></div>
      </div>
      <div class="lgutter" style="grid-area: lgutter;">
        <div class="preview"></div>
        <div class="repeat"></div>
      </div>
      <div
        class="pattern-container"
        id="pattern-container"
        style="grid-area: pattern;">
        <canvas id="preview"></canvas>
        <canvas id="preview-symbols"></canvas>
        <canvas id="preview-needles"></canvas>
        <canvas id="repeat"></canvas>
        <canvas id="pattern-highlight"></canvas>
        <canvas id="pattern-grid" style="image-rendering:pixelated"></canvas>
      </div>

      <div class="bgutter" style="grid-area: bgutter;">
        <div class="preview"></div>
        <div class="repeat"></div>
      </div>

      <div id="color-change-container" style="grid-area: colors;">
        <div id="height-dragger">
          <div id="color-dragger" class="dragger vertical grab">
            <i class="fa-solid fa-grip fa-xs"></i>
          </div>
          <canvas id="color-change-editor" height="25" width="25"></canvas>
          <canvas
            id="color-change-grid"
            height="25"
            width="25"
            style="image-rendering:pixelated"></canvas>
        </div>
        <div id="color-controls">
          <div id="yarn-palette"></div>
        </div>
      </div>
      <div id="size-container" style="grid-area: size;">
        <div id="repeat-width"></div>
        <div id="repeat-height"></div>
      </div>
      <div id="needle-container" style="grid-area: needles;">
        <canvas id="needle-editor" height="25" width="25"></canvas>
        <div id="needle-dragger" class="dragger horizontal grab">
          <i class="fa-solid fa-grip-vertical fa-xs"></i>
        </div>
      </div>
      <div id="sim-controls" style="grid-area: simcontrols">
        ${widthSpinner()} ${heightSpinner()}
        <button @click=${() => relax()}>relax</button>
        <button @click=${() => flip()}>flip</button>
      </div>
      <div id="sim-container" style="grid-area: sim">
        <svg id="simulation"></svg>
      </div>
    </div>
  `;
}

function regenPreview() {
  const { colorLayer, symbolLayer } = generateYarnPreview(
    Bimp.fromJSON(repeatEditor.state.bitmap),
    colorChangeEditor.state.bitmap.vMirror().pixels
  );

  preview.dispatch({
    bitmap: colorLayer,
    symbolMap: symbolLayer,
    scale: GLOBAL_STATE.scale / devicePixelRatio,
    needles: Array.from(needleEditor.state.bitmap.pixels),
  });

  GLOBAL_STATE.updateSim = true;
}

function syncScale() {
  const bbox = document
    .getElementById("pattern-container")
    .getBoundingClientRect();

  const actualX = bbox.width * devicePixelRatio;
  const actualY = bbox.height * devicePixelRatio;

  const actualScale = GLOBAL_STATE.scale;

  GLOBAL_STATE.previewX = Math.floor(actualX / actualScale) - 1;
  GLOBAL_STATE.previewY = Math.floor(actualY / actualScale);

  const scale = actualScale / devicePixelRatio;

  repeatEditor.dispatch({ scale });
  colorChangeEditor.dispatch({ scale });
  preview.dispatch({ scale });
  needleEditor.dispatch({ scale });

  regenPreview();
  // runSimulation();
}

function generateYarnPreview(repeat, yarnChanges) {
  let width = GLOBAL_STATE.previewX;
  let height = GLOBAL_STATE.previewY;
  let tiled = Bimp.fromTile(width, height, repeat.vMirror());

  let recolor = [];
  let stitchMap = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      recolor.push(yarnChanges[y % yarnChanges.length]);
      stitchMap.push(tiled.pixel(x, y));
    }
  }

  let colored = new Bimp(width, height, recolor);
  let stitches = new Bimp(width, height, stitchMap);

  return { colorLayer: colored.vMirror(), symbolLayer: stitches.vMirror() };
}

function runSimulation() {
  render(view(), document.body);

  if (!GLOBAL_STATE.updateSim) return;
  GLOBAL_STATE.updateSim = false;

  if (clear) clear();

  ({ clear, relax, flip } = simulate(
    Bimp.fromTile(
      GLOBAL_STATE.simWidth,
      GLOBAL_STATE.simHeight,
      repeatEditor.state.bitmap.vMirror()
    ).vMirror(),
    colorChangeEditor.state.bitmap.pixels,
    Array.from(needleEditor.state.bitmap.pixels),
    GLOBAL_STATE.yarnPalette
  ));
}

window.onmouseup = function () {
  setTimeout(() => runSimulation(), 30);
};

async function init() {
  loadWorkspace(startState);
  render(view(), document.body);

  let repeatEditorCanvas = document.getElementById("repeat");
  let colorChangeEditorCanvas = document.getElementById("color-change-editor");
  let needleEditorCanvas = document.getElementById("needle-editor");

  // Make the initial bitmaps based on global state
  let initial = generateYarnPreview(
    Bimp.fromJSON(GLOBAL_STATE.repeat),
    GLOBAL_STATE.yarns.pixels
  );

  // Build all the editors
  repeatEditor = await buildRepeatEditor(GLOBAL_STATE, repeatEditorCanvas);
  colorChangeEditor = buildColorChangeEditor(
    GLOBAL_STATE,
    colorChangeEditorCanvas
  );
  needleEditor = await buildNeedleEditor(GLOBAL_STATE, needleEditorCanvas);
  preview = await buildPreview(GLOBAL_STATE, initial);

  // Synchronize editor changes
  repeatEditor.addEffect("bitmap", regenPreview);
  needleEditor.addEffect("bitmap", regenPreview);

  colorChangeEditor.addEffect("bitmap", regenPreview);

  // Sync changes to palette
  colorChangeEditor.addEffect("palette", ({ palette }) => {
    GLOBAL_STATE.yarnPalette = palette;
    GLOBAL_STATE.updateSim = true;

    preview.dispatch({
      palette,
    });

    runSimulation();
  });

  // Sync mouse position between preview and repeat editor
  preview.addEffect("pos", ({ bitmap, pos }) => {
    if (pos.x > -1 || pos.y > -1) {
      let newX = pos.x % repeatEditor.state.bitmap.width;
      let newY =
        repeatEditor.state.bitmap.height -
        ((bitmap.height - pos.y) % repeatEditor.state.bitmap.height);

      newY = newY == repeatEditor.state.bitmap.height ? 0 : newY;
      repeatEditor.dispatch({
        pos: {
          x: newX,
          y: newY,
        },
      });
    }
  });

  // Finally, explicitly synchronize the scale and run the sim
  syncScale();
  runSimulation();
}

window.onload = init;
