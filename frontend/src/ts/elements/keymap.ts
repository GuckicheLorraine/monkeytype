import Config from "../config";
import * as ThemeColors from "./theme-colors";
import * as SlowTimer from "../states/slow-timer";
import * as ConfigEvent from "../observables/config-event";
import * as KeymapEvent from "../observables/keymap-event";
import * as Misc from "../utils/misc";
import * as JSONData from "../utils/json-data";
import * as Hangul from "hangul-js";
import * as Notifications from "../elements/notifications";
import * as ActivePage from "../states/active-page";
import * as TestWords from "../test/test-words";

const stenoKeys: JSONData.Layout = {
  keymapShowTopRow: true,
  type: "matrix",
  keys: {
    row1: [],
    row2: ["sS", "tT", "pP", "hH", "**", "fF", "pP", "lL", "tT", "dD"],
    row3: ["sS", "kK", "wW", "rR", "**", "rR", "bB", "gG", "sS", "zZ"],
    row4: ["aA", "oO", "eE", "uU"],
    row5: [],
  },
};

function highlightKey(currentKey: string): void {
  if (Config.mode === "zen") return;
  if (currentKey === "") currentKey = " ";
  try {
    $(".activeKey").removeClass("activeKey");

    let highlightKey;
    if (Config.language.startsWith("korean")) {
      currentKey = Hangul.disassemble(currentKey)[0] ?? currentKey;
    }
    if (currentKey === " ") {
      highlightKey = "#keymap .keySpace";
    } else if (currentKey === '"') {
      highlightKey = `#keymap .keymapKey[data-key*='${currentKey}']`;
    } else {
      highlightKey = `#keymap .keymapKey[data-key*="${currentKey}"]`;
    }

    // console.log("highlighting", highlightKey);

    $(highlightKey).addClass("activeKey");
  } catch (e) {
    if (e instanceof Error) {
      console.log("could not update highlighted keymap key: " + e.message);
    }
  }
}

async function flashKey(key: string, correct?: boolean): Promise<void> {
  if (key === undefined) return;
  //console.log("key", key);
  if (key === " ") {
    key = "#keymap .keySpace";
  } else if (key === '"') {
    key = `#keymap .keymapKey[data-key*='${key}']`;
  } else {
    key = `#keymap .keymapKey[data-key*="${key}"]`;
  }

  const themecolors = await ThemeColors.getAll();

  try {
    let css = {
      color: themecolors.bg,
      backgroundColor: themecolors.sub,
      borderColor: themecolors.sub,
    };

    if (correct || Config.blindMode) {
      css = {
        color: themecolors.bg,
        backgroundColor: themecolors.main,
        borderColor: themecolors.main,
      };
    } else {
      css = {
        color: themecolors.bg,
        backgroundColor: themecolors.error,
        borderColor: themecolors.error,
      };
    }

    $(key)
      .stop(true, true)
      .css(css)
      .animate(
        {
          color: themecolors.sub,
          backgroundColor: themecolors.subAlt,
          borderColor: themecolors.sub,
        },
        SlowTimer.get() ? 0 : 500,
        "easeOutExpo"
      );
  } catch (e) {}
}

export function hide(): void {
  $("#keymap").addClass("hidden");
}

export function show(): void {
  $("#keymap").removeClass("hidden");
}

export async function refresh(
  layoutName: string = Config.layout
): Promise<void> {
  if (Config.keymapMode === "off") return;
  if (ActivePage.get() !== "test") return;
  if (!layoutName) return;
  let r5_grid = "";
  let hasAlphas = false;
  try {
    let layouts;
    try {
      layouts = await JSONData.getLayoutsList();
    } catch (e) {
      Notifications.add(
        Misc.createErrorMessage(e, "Failed to refresh keymap"),
        -1
      );
      return;
    }

    let lts = layouts[layoutName]; //layout to show

    let layoutString = layoutName;
    if (Config.keymapLayout === "overrideSync") {
      if (Config.layout === "default") {
        lts = layouts["qwerty"];
        layoutString = "default";
      } else {
        lts = layouts[Config.layout];
        layoutString = Config.layout;
      }
    } else {
      lts = layouts[Config.keymapLayout];
      layoutString = Config.keymapLayout;
    }

    const showTopRow =
      (TestWords.hasNumbers && Config.keymapMode === "next") ||
      Config.keymapShowTopRow === "always" ||
      ((lts as (typeof layouts)["qwerty"]).keymapShowTopRow &&
        Config.keymapShowTopRow !== "never");

    const isMatrix =
      Config.keymapStyle === "matrix" || Config.keymapStyle === "split_matrix";

    const isSteno =
      Config.keymapStyle === "steno" || Config.keymapStyle === "steno_matrix";

    const isAlice = Config.keymapStyle === "alice";

    if (isSteno) {
      lts = stenoKeys;
    }

    if (lts === undefined) {
      throw new Error("Failed to refresh keymap: layout not found");
    }

    const isISO = lts.type === "iso";

    let keymapElement = "";

    // ( as (keyof MonkeyTypes.Keys)[]).forEach(
    //   (row, index) => {

    const rowIds = Object.keys(lts.keys);

    for (let index = 0; index < rowIds.length; index++) {
      const row = rowIds[index] as keyof JSONData.Keys;
      let rowKeys = lts.keys[row];
      if (row === "row1" && (isMatrix || Config.keymapStyle === "staggered")) {
        rowKeys = rowKeys.slice(1);
      }
      let rowElement = "";
      if (row === "row1" && (!showTopRow || isSteno)) {
        continue;
      }

      if (
        (row === "row2" || row === "row3" || row === "row4") &&
        !isMatrix &&
        !isSteno
      ) {
        rowElement += "<div></div>";
      }

      if (row === "row4" && !isISO && !isMatrix && !isSteno) {
        rowElement += "<div></div>";
      }

      if (isMatrix) {
        if (row !== "row5" && lts.matrixShowRightColumn) {
          rowElement += `<div class="keymapKey"></div>`;
        } else {
          rowElement += `<div></div>`;
        }
      }

      if (row === "row5") {
        if (isSteno) continue;
        let layoutDisplay = layoutString.replace(/_/g, " ");
        let letterStyle = "";
        if (Config.keymapLegendStyle === "blank") {
          letterStyle = `style="display: none;"`;
        }
        /* ROW 5 in alternate keymaps allow for alphas in thumb keys.
         * These keymaps MUST include two keys in row 5,
         * an alpha and a space, or a space and an alpha.
         * Alpha key is rendered with the regular alpha size.
         * Layout name is automatically added in the space key.
         * Visual keymap will be:
         * 1-3 for 1 alpha and 1 space
         * 3-1 for 1 space and 1 alpha
         * Together with the data-row5-has-alpha="true",
         * these two will be used to edit the CSS grid layout.
         * 3-3 for two spaces of size 3. This will not be used to edit CSS,
         * since it means a traditional layout, can keep current CSS grid.
         * It is just created for simplicity in the for loop below.
         * */
        // If only one space, add another
        if (rowKeys.length === 1 && rowKeys[0] === " ") {
          rowKeys[1] = rowKeys[0];
        }
        // If only one alpha, add one space and place it on the left
        if (rowKeys.length === 1 && rowKeys[0] !== " ") {
          rowKeys[1] = " ";
          rowKeys.reverse();
        }
        // If two alphas equal, replace one with a space on the left
        if (
          rowKeys.length > 1 &&
          rowKeys[0] !== " " &&
          rowKeys[0] === rowKeys[1]
        ) {
          rowKeys[0] = " ";
        }
        const alphas = (v: string): boolean => v !== " ";
        hasAlphas = rowKeys.some(alphas);

        rowElement += "<div></div>";

        for (let i = 0; i < rowKeys.length; i++) {
          const key = rowKeys[i] as string;
          let keyDisplay = key[0] as string;
          if (Config.keymapLegendStyle === "uppercase") {
            keyDisplay = keyDisplay.toUpperCase();
          }
          const keyVisualValue = key.replace('"', "&quot;");
          // these are used to keep grid layout but magically hide keys using opacity:
          let side = i < 1 ? "left" : "right";
          // we won't use this trick for alternate layouts, unless Alice (for rotation):
          if (hasAlphas && !isAlice) side = "";
          if (i === 1) {
            rowElement += `<div class="keymapSplitSpacer"></div>`;
            r5_grid += "-";
          }
          if (keyVisualValue === " ") {
            rowElement += `<div class="keymapKey keySpace layoutIndicator ${side}">
              <div class="letter" ${letterStyle}>${layoutDisplay}</div>
            </div>`;
            r5_grid += "3";
            // potential second space in next loop iterations will be empty:
            layoutDisplay = "";
          } else {
            rowElement += `<div class="keymapKey ${side}">
              <div class="letter">${keyDisplay}</div>
            </div>`;
            r5_grid += "1";
          }
        }
      } else {
        for (let i = 0; i < rowKeys.length; i++) {
          if (row === "row2" && i === 12) continue;
          if (row === "row4" && isMatrix && isISO && i === 0) continue;

          let colLimit = 10;
          if (lts.matrixShowRightColumn) {
            colLimit = 11;
          }
          if (row === "row4" && isMatrix && isISO) {
            colLimit += 1;
          }

          if (
            (Config.keymapStyle === "matrix" ||
              Config.keymapStyle === "split_matrix") &&
            i >= colLimit
          ) {
            continue;
          }
          const key = rowKeys[i] as string;
          const bump = row === "row3" && (i === 3 || i === 6) ? true : false;
          let keyDisplay = key[0] as string;
          let letterStyle = "";
          if (Config.keymapLegendStyle === "blank") {
            letterStyle = `style="display: none;"`;
          } else if (Config.keymapLegendStyle === "uppercase") {
            keyDisplay = keyDisplay.toUpperCase();
          }
          let hide = "";
          if (
            row === "row1" &&
            i === 0 &&
            !isMatrix &&
            Config.keymapStyle !== "staggered"
          ) {
            hide = ` invisible`;
          }

          const keyElement = `<div class="keymapKey${hide}" data-key="${key.replace(
            '"',
            "&quot;"
          )}">
              <span class="letter" ${letterStyle}>${keyDisplay}</span>
              ${bump ? "<div class='bump'></div>" : ""}
          </div>`;

          let splitSpacer = "";
          if (
            Config.keymapStyle === "split" ||
            Config.keymapStyle === "split_matrix" ||
            Config.keymapStyle === "alice" ||
            isSteno
          ) {
            if (row === "row4" && isSteno && (i === 0 || i === 2 || i === 4)) {
              splitSpacer += `<div class="keymapSplitSpacer"></div>`;
            } else if (
              row === "row4" &&
              (Config.keymapStyle === "split" ||
                Config.keymapStyle === "alice") &&
              isISO
            ) {
              if (i === 6) {
                splitSpacer += `<div class="keymapSplitSpacer"></div>`;
              }
            } else if (
              row === "row1" &&
              (Config.keymapStyle === "split" || Config.keymapStyle === "alice")
            ) {
              if (i === 7) {
                splitSpacer += `<div class="keymapSplitSpacer"></div>`;
              }
            } else if (row === "row4" && isMatrix && isISO) {
              if (i === 6) {
                splitSpacer += `<div class="keymapSplitSpacer"></div>`;
              }
            } else {
              if (i === 5) {
                splitSpacer += `<div class="keymapSplitSpacer"></div>`;
              }
            }
          }

          if (Config.keymapStyle === "alice" && row === "row4") {
            if ((isISO && i === 6) || (!isISO && i === 5)) {
              splitSpacer += `<div class="extraKey"><span class="letter"></span></div>`;
            }
          }

          rowElement += splitSpacer + keyElement;
        }
      }

      if (row === "row5") {
        keymapElement += `<div
          class="row r${index + 1}"
          data-row5-grid="${r5_grid}"
          data-row5-has-alpha="${hasAlphas}"
        >${rowElement}</div>`;
      } else {
        keymapElement += `<div class="row r${index + 1}">${rowElement}</div>`;
      }
    }
    // );

    $("#keymap").html(keymapElement);

    $("#keymap").removeClass("staggered");
    $("#keymap").removeClass("matrix");
    $("#keymap").removeClass("split");
    $("#keymap").removeClass("split_matrix");
    $("#keymap").removeClass("alice");
    $("#keymap").removeClass("steno");
    $("#keymap").removeClass("steno_matrix");
    $("#keymap").addClass(Config.keymapStyle);
  } catch (e) {
    if (e instanceof Error) {
      console.log(
        "something went wrong when changing layout, resettings: " + e.message
      );
      // UpdateConfig.setKeymapLayout("qwerty", true);
    }
  }
}

ConfigEvent.subscribe((eventKey, newValue) => {
  if (eventKey === "layout" && Config.keymapLayout === "overrideSync") {
    void refresh(Config.keymapLayout);
  }
  if (
    eventKey === "keymapLayout" ||
    eventKey === "keymapStyle" ||
    eventKey === "keymapShowTopRow" ||
    eventKey === "keymapMode"
  ) {
    void refresh();
  }
  if (eventKey === "keymapMode") {
    newValue === "off" ? hide() : show();
  }
});

KeymapEvent.subscribe((mode, key, correct) => {
  if (mode === "highlight") {
    highlightKey(key);
  }
  if (mode === "flash") {
    void flashKey(key, correct);
  }
});
