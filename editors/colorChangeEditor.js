import { html, render } from "lit-html";

import { BimpEditor } from "../bimp/BimpEditor";
import { Bimp } from "../bimp/Bimp";

import { pointerTracker } from "../bimp/pointerTracker";
import { grid } from "../bimp/grid";
import { canvasScaler } from "../bimp/canvasScaler";
import { paletteRenderer } from "../bimp/paletteRenderer";
import { hexPalette, getRandomColor, shuffle } from "../utils";
import { pointerEvents } from "../bimp/pointerEvents";
import { brush } from "../bimp/tools";
import { stateHook } from "../bimp/stateHook";

function hexPaletteSelect(container) {
  return (state, dispatch) =>
    render(
      html`
        <button
          style="aspect-ratio: 1;"
          @click=${() => {
            let newPalette = [...state.palette];
            newPalette.push(getRandomColor());
            dispatch({ palette: newPalette });
          }}>
          <i class="fa-solid fa-plus"></i>
        </button>

        <div class="palette-select">
          ${state.palette.map(
            (hex, index) =>
              html`<div
                style="background-color: ${hex}"
                class="hex-select ${index == state.paletteIndex
                  ? "selected"
                  : ""}"
                @click=${() => dispatch({ paletteIndex: index })}>
                <label class="edit-color" for="color-${index}">
                  <i class="fa-solid fa-pen"></i>
                </label>
                <input
                  id="color-${index}"
                  type="color"
                  value="${hex}"
                  @input=${(e) => {
                    let newPalette = [...state.palette];
                    newPalette[index] = e.target.value;
                    dispatch({ palette: newPalette });
                  }} />
              </div>`
          )}
        </div>
        <button
          style="aspect-ratio: 1;"
          @click=${() => {
            dispatch({
              palette: shuffle(state.palette),
            });
          }}>
          <i class="fa-solid fa-arrows-rotate"></i>
        </button>
        <button
          style="aspect-ratio: 1;"
          @click=${() => {
            dispatch({
              palette: Array.from(Array(state.palette.length), () =>
                getRandomColor()
              ),
            });
          }}>
          <i class="fa-solid fa-dice"></i>
        </button>
      `,
      container
    );
}

// function yarnHeightSpinner({ container }) {
//   return (state, dispatch) => {
//     let { bitmap } = state;
//     render(
//       html`<div class="spinner vertical">
//         <button
//           class="plus"
//           @click=${() =>
//             dispatch({
//               bitmap: bitmap
//                 .vMirror()
//                 .resize(bitmap.width, bitmap.height + 1)
//                 .vMirror(),
//             })}>
//           <i class="fa-solid fa-plus"></i>
//         </button>
//         <input
//           type="text"
//           .value=${live(bitmap.height)}
//           class="size-input"
//           @change=${(e) =>
//             dispatch({
//               bitmap: bitmap
//                 .vMirror()
//                 .resize(bitmap.width, Number(e.target.value))
//                 .vMirror(),
//             })} />

//         <button
//           class="minus"
//           @click=${() =>
//             dispatch({
//               bitmap: bitmap
//                 .vMirror()
//                 .resize(bitmap.width, bitmap.height - 1)
//                 .vMirror(),
//             })}>
//           <i class="fa-solid fa-minus"></i>
//         </button>
//       </div>`,
//       container
//     );
//   };
// }

function resizeDragger(dragger) {
  return ({ state, dispatch }) => {
    let { bitmap, scale } = state;

    dragger.addEventListener("pointerdown", (e) => {
      const startBIMP = bitmap;
      const start = e.clientY;

      document.body.classList.add("grabbing");
      dragger.classList.remove("grab");

      const end = () => {
        console.log("end");
        document.body.classList.remove("grabbing");

        window.removeEventListener("mousemove", onmove);
        window.removeEventListener("pointerup", end);

        dragger.classList.add("grab");
      };

      const onmove = (e) => {
        let newSize =
          startBIMP.height + Math.floor((start - e.clientY) / scale);
        if (newSize < 1) return;

        dispatch({
          bitmap: startBIMP
            .vMirror()
            .resize(startBIMP.width, newSize)
            .vMirror(),
        });
      };

      window.addEventListener("mousemove", onmove);
      window.addEventListener("pointerup", end);
    });

    return {
      syncState(state) {
        ({ bitmap, scale } = state);
      },
    };
  };
}

export function buildColorChangeEditor(state, canvas) {
  const dragger = document.getElementById("color-dragger");
  const gridCanvas = document.getElementById("color-change-grid");
  return new BimpEditor({
    state: {
      bitmap: Bimp.fromJSON(state.yarns).vMirror(),
      palette: state.yarnPalette,
    },

    components: [
      pointerTracker({ target: gridCanvas }),
      canvasScaler({ canvas }),
      canvasScaler({ canvas: gridCanvas }),
      paletteRenderer({
        drawFunc: hexPalette,
        canvas,
      }),
      grid({ canvas: gridCanvas }),
      pointerEvents({
        tools: { brush },
        eventTarget: gridCanvas,
      }),

      stateHook({
        cb: hexPaletteSelect(document.getElementById("yarn-palette")),
      }),
      resizeDragger(dragger),
    ],
  });
}
