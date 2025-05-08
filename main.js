'use strict';

var obsidian = require('obsidian');

// __extends and extendStatics functions (keep as is)
/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */
var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics(d, b);
};
function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

const DEFAULT_SETTINGS = {
    animationDuration: 2,
    showHeader: false,
    showScroll: false,
    showGraphControls: false,
    forceReadable: true,
    vignetteOpacity: 0.75,
    vignetteScaleLinear: 20,
    vignetteScaleRadial: 75
};

var FullScreenPlugin = /** @class */ (function (_super) {
    __extends(FullScreenPlugin, _super);
    function FullScreenPlugin() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.settings = DEFAULT_SETTINGS;
        _this.isZenModeActive = false;
        _this.activeLeafWhenZenModeStarted = null;
        return _this;
    }

    FullScreenPlugin.prototype.onload = async function () {
        console.log("ZenMode: Plugin loading.");
        await this.loadSettings();

        this.addCommand({
            id: "zen-mode-toggle",
            name: "Toggle Zen mode",
            callback: this.toggleZenMode.bind(this),
        });

        this.addSettingTab(new ZenModeSettingTab(this.app, this));
        console.log("ZenMode: Plugin loaded.");
    };

    FullScreenPlugin.prototype.onunload = function () {
        console.log("ZenMode: Plugin unloading.");
        if (this.isZenModeActive || document.body.classList.contains('obsidian-zen-mode-active')) {
            this.exitSimulatedFullscreen();
        }
        this.resetCssVariables();
        console.log("ZenMode: Plugin unloaded.");
    };

    FullScreenPlugin.prototype.loadSettings = async function () {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    };

    FullScreenPlugin.prototype.saveSettings = async function () {
        await this.saveData(this.settings);
    };

    FullScreenPlugin.prototype.setCssVariables = function () {
        const root = document.documentElement;
        root.style.setProperty('--fadeIn-duration', this.settings.animationDuration + 's');
        root.style.setProperty('--vignette-opacity', String(this.settings.vignetteOpacity));
        root.style.setProperty('--vignette-scale-linear', this.settings.vignetteScaleLinear + '%');
        root.style.setProperty('--vignette-scale-radial', this.settings.vignetteScaleRadial + '%');
    };

    FullScreenPlugin.prototype.resetCssVariables = function () {
        const root = document.documentElement;
        root.style.removeProperty('--fadeIn-duration');
        root.style.removeProperty('--vignette-opacity');
        root.style.removeProperty('--vignette-scale-linear');
        root.style.removeProperty('--vignette-scale-radial');
    };

    FullScreenPlugin.prototype.toggleZenMode = function () {
        const isCurrentlyInZenModeDOM = document.body.classList.contains('obsidian-zen-mode-active');
        console.log("ZenMode: TOGGLE - DOM check for 'obsidian-zen-mode-active':", isCurrentlyInZenModeDOM);
        console.log("ZenMode: TOGGLE - Current plugin state this.isZenModeActive (before action):", this.isZenModeActive);

        if (isCurrentlyInZenModeDOM) {
            console.log("ZenMode: TOGGLE - DOM indicates active. Attempting to call exitSimulatedFullscreen.");
            this.exitSimulatedFullscreen();
        } else {
            console.log("ZenMode: TOGGLE - DOM indicates inactive. Attempting to call enterSimulatedFullscreen.");
            const leaf = this.app.workspace.getActiveViewOfType(obsidian.ItemView)?.leaf;
            if (!leaf) {
                new obsidian.Notice("No active view to enter Zen mode.");
                console.log("ZenMode: TOGGLE - No active leaf found for entry.");
                return;
            }
            if (leaf.view.getViewType() === "empty") {
                new obsidian.Notice("Cannot enter Zen mode on an empty view.");
                console.log("ZenMode: TOGGLE - Active leaf is empty, cannot enter.");
                return;
            }
            this.enterSimulatedFullscreen(leaf);
        }
        console.log("ZenMode: TOGGLE - Current plugin state this.isZenModeActive (after action):", this.isZenModeActive);
    };

    FullScreenPlugin.prototype.enterSimulatedFullscreen = function (leaf) {
        console.log("ZenMode: ENTER - Start. Current plugin state this.isZenModeActive:", this.isZenModeActive);
        if (!leaf) {
            console.log("ZenMode: ENTER - Aborting, no leaf provided.");
            return;
        }
        if (this.isZenModeActive && document.body.classList.contains('obsidian-zen-mode-active')) {
            console.warn("ZenMode: ENTER - Aborting, plugin state 'isZenModeActive' is true AND body class 'obsidian-zen-mode-active' is present. Exiting might be more appropriate.");
            return;
        }

        try {
            this.activeLeafWhenZenModeStarted = leaf;
            // It's crucial to get the .workspace-leaf as it's the one we'll be styling for fullscreen
            const leafEl = this.activeLeafWhenZenModeStarted.view.containerEl.closest('.workspace-leaf');

            if (!leafEl) {
                console.error("ZenMode: ENTER - Could not find .workspace-leaf for the active view.", leaf);
                new obsidian.Notice("Error entering Zen mode. See console.");
                this.activeLeafWhenZenModeStarted = null;
                return;
            }
            console.log("ZenMode: ENTER - Found leafEl:", leafEl);

            this.setCssVariables();

            console.log("ZenMode: ENTER - Body classes BEFORE add:", document.body.className);
            document.body.classList.add('obsidian-zen-mode-active');
            console.log("ZenMode: ENTER - Body classes AFTER add:", document.body.className);

            console.log("ZenMode: ENTER - LeafEl classes BEFORE add:", leafEl.className);
            leafEl.classList.add('zen-mode-active-leaf');
            console.log("ZenMode: ENTER - LeafEl classes AFTER add:", leafEl.className);

            console.log("ZenMode: ENTER - Calling addStyles for leaf:", this.activeLeafWhenZenModeStarted.view?.type);
            this.addStyles(this.activeLeafWhenZenModeStarted); // This is where the error occurred

            this.isZenModeActive = true;
            console.log("ZenMode: ENTER - Successfully entered. New plugin state this.isZenModeActive:", this.isZenModeActive);
            new obsidian.Notice("Zen mode activated", 1500);

        } catch (error) {
            console.error("ZenMode: ENTER - Error during enterSimulatedFullscreen:", error);
            if (this.activeLeafWhenZenModeStarted && this.activeLeafWhenZenModeStarted.view && this.activeLeafWhenZenModeStarted.view.containerEl) {
                const leafElOnError = this.activeLeafWhenZenModeStarted.view.containerEl.closest('.workspace-leaf');
                if (leafElOnError) {
                    console.log("ZenMode: ENTER (error cleanup) - Removing 'zen-mode-active-leaf' from:", leafElOnError);
                    leafElOnError.classList.remove('zen-mode-active-leaf');
                }
                console.log("ZenMode: ENTER (error cleanup) - Calling removeStyles.");
                this.removeStyles(this.activeLeafWhenZenModeStarted);
            }
            console.log("ZenMode: ENTER (error cleanup) - Removing 'obsidian-zen-mode-active' from body.");
            document.body.classList.remove('obsidian-zen-mode-active');
            this.resetCssVariables();
            
            this.isZenModeActive = false;
            this.activeLeafWhenZenModeStarted = null;
            console.log("ZenMode: ENTER (error cleanup) - Plugin state reset. isZenModeActive:", this.isZenModeActive);
            new obsidian.Notice("Failed to enter Zen mode. Check console.", 3000);
        }
    };

    FullScreenPlugin.prototype.exitSimulatedFullscreen = function () {
        console.log("ZenMode: EXIT - Start. Current plugin state this.isZenModeActive:", this.isZenModeActive);
        try {
            let leafEl = null;
            if (this.activeLeafWhenZenModeStarted && this.activeLeafWhenZenModeStarted.view && this.activeLeafWhenZenModeStarted.view.containerEl) {
                leafEl = this.activeLeafWhenZenModeStarted.view.containerEl.closest('.workspace-leaf');
                console.log("ZenMode: EXIT - Found leafEl from stored activeLeaf:", leafEl);
            } else {
                console.warn("ZenMode: EXIT - Original activeLeafWhenZenModeStarted is missing/invalid. Fallback: Searching for any .zen-mode-active-leaf on DOM.");
                leafEl = document.querySelector('.workspace-leaf.zen-mode-active-leaf');
                if (leafEl) {
                     console.log("ZenMode: EXIT - Found leafEl via querySelector fallback:", leafEl);
                } else {
                     console.warn("ZenMode: EXIT - Fallback querySelector did not find any .zen-mode-active-leaf.");
                }
            }

            if (leafEl) {
                console.log("ZenMode: EXIT - LeafEl classes BEFORE remove 'zen-mode-active-leaf':", leafEl.className);
                leafEl.classList.remove('zen-mode-active-leaf');
                console.log("ZenMode: EXIT - LeafEl classes AFTER remove 'zen-mode-active-leaf':", leafEl.className);
            } else {
                console.warn("ZenMode: EXIT - No leafEl found (neither stored nor queried) to remove 'zen-mode-active-leaf' from.");
            }

            console.log("ZenMode: EXIT - Body classes BEFORE remove 'obsidian-zen-mode-active':", document.body.className);
            document.body.classList.remove('obsidian-zen-mode-active');
            console.log("ZenMode: EXIT - Body classes AFTER remove 'obsidian-zen-mode-active':", document.body.className);

            if (this.activeLeafWhenZenModeStarted && this.activeLeafWhenZenModeStarted.view) {
                console.log("ZenMode: EXIT - Calling removeStyles for leaf:", this.activeLeafWhenZenModeStarted.view?.type);
                this.removeStyles(this.activeLeafWhenZenModeStarted);
            } else {
                console.warn("ZenMode: EXIT - Cannot call removeStyles, original activeLeafWhenZenModeStarted reference is missing/invalid.");
            }

            console.log("ZenMode: EXIT - Calling resetCssVariables.");
            this.resetCssVariables();
            
            // Only show notice if plugin thought it was active OR if body class was present (to cover cases where state might be out of sync)
            if (this.isZenModeActive || document.body.classList.contains('obsidian-zen-mode-active')) { 
                new obsidian.Notice("Zen mode deactivated", 1500);
            }
            console.log("ZenMode: EXIT - Successfully processed exit logic (before finally block).");

        } catch (error) {
            console.error("ZenMode: EXIT - Error during exitSimulatedFullscreen:", error);
            console.log("ZenMode: EXIT (error cleanup) - Removing 'obsidian-zen-mode-active' from body (if present).");
            document.body.classList.remove('obsidian-zen-mode-active');
            const anyActiveLeaf = document.querySelector('.workspace-leaf.zen-mode-active-leaf');
            if (anyActiveLeaf) {
                console.log("ZenMode: EXIT (error cleanup) - Removing 'zen-mode-active-leaf' from potentially orphaned leaf:", anyActiveLeaf);
                anyActiveLeaf.classList.remove('zen-mode-active-leaf');
            }
            this.resetCssVariables();
            new obsidian.Notice("Error exiting Zen mode. Check console.", 3000);
        } finally {
            console.log("ZenMode: EXIT (finally) - Resetting plugin state. Current isZenModeActive before reset:", this.isZenModeActive);
            this.isZenModeActive = false;
            this.activeLeafWhenZenModeStarted = null;
            console.log("ZenMode: EXIT (finally) - Plugin state reset. New isZenModeActive:", this.isZenModeActive);
        }
    };

    // Updated addStyles method
    FullScreenPlugin.prototype.addStyles = function (leaf) {
        const viewEl = leaf.view.contentEl;
        const headerEl = leaf.view.headerEl;
        const isGraph = leaf.view.getViewType() === "graph";

        if (!viewEl || !headerEl) {
            console.warn("ZenMode AddStyles: viewEl or headerEl not found for leaf:", leaf);
            return;
        }

        let graphControls;
        if (isGraph && leaf.view.dataEngine && typeof leaf.view.dataEngine.controlsEl !== 'undefined') {
             graphControls = leaf.view.dataEngine.controlsEl;
        }

        if (!this.settings.showScroll && viewEl) { viewEl.classList.add("zen-noscroll"); } // Added viewEl check
        if (isGraph && graphControls && !this.settings.showGraphControls) { graphControls.classList.add("zen-hide"); }

        if (this.settings.vignetteOpacity > 0 && viewEl) { // Added viewEl check
            isGraph ? viewEl.classList.add("zen-vignette-radial") : viewEl.classList.add("zen-vignette-linear");
        }

        if (!isGraph && this.settings.forceReadable) {
            if (leaf.view instanceof obsidian.MarkdownView) {
                const markdownView = leaf.view; // obsidian.MarkdownView

                if (markdownView.editor && markdownView.editor.editorEl) {
                    // Primary target for editor mode: editor.editorEl
                    markdownView.editor.editorEl.classList.add("is-readable-line-width");
                    // console.log("ZenMode AddStyles: Applied 'is-readable-line-width' to editor.editorEl"); // Optional: for debugging
                } else if (markdownView.editor) {
                    // Fallback for editor mode if editor.editorEl is missing
                    // This block replaces the old console.warn and skip.
                    console.warn("ZenMode AddStyles: markdownView.editor.editorEl is undefined. Attempting fallbacks for editor mode...");
                    if (markdownView.contentEl) { // Check if contentEl (e.g., .markdown-source-view) exists
                        const cmEditorDiv = markdownView.contentEl.querySelector('.cm-editor');
                        if (cmEditorDiv) {
                            // Fallback 1: Found '.cm-editor' div inside contentEl
                            cmEditorDiv.classList.add("is-readable-line-width");
                            console.log("ZenMode AddStyles: Applied 'is-readable-line-width' to '.cm-editor' div.");
                        } else {
                            // Fallback 2: '.cm-editor' not found, apply to contentEl itself
                            // This might make the entire source view readable, which can be acceptable.
                            markdownView.contentEl.classList.add("is-readable-line-width");
                            console.warn("ZenMode AddStyles: '.cm-editor' not found in contentEl. Applied 'is-readable-line-width' to contentEl as a fallback for editor mode.");
                        }
                    } else {
                        // If contentEl is also missing, we can't do much for editor mode.
                        console.error("ZenMode AddStyles: markdownView.contentEl is also null. Cannot apply 'is-readable-line-width' for editor mode.");
                    }
                } else if (markdownView.previewMode && markdownView.contentEl) {
                    // Target for preview (reading) mode: contentEl (e.g., .markdown-preview-view)
                    // This uses your custom class 'zen-force-readable-preview' as per original logic.
                    markdownView.contentEl.classList.add("zen-force-readable-preview");
                    // console.log("ZenMode AddStyles: Applied 'zen-force-readable-preview' to contentEl for preview mode."); // Optional: for debugging
                } else {
                    // Neither editor with known elements, nor preview mode with contentEl.
                     console.warn("ZenMode AddStyles: MarkdownView state unclear or essential elements missing. Skipping readable width styling for this MarkdownView.");
                }
            } else if (viewEl) { // For non-Markdown views (viewEl is leaf.view.contentEl)
                 viewEl.classList.add("zen-generic-readable");
                 // console.log("ZenMode AddStyles: Applied 'zen-generic-readable' to viewEl for non-Markdown view."); // Optional: for debugging
            }
        }

        if (viewEl) viewEl.classList.add("zen-animate");
        // headerEl is checked at the top
        this.settings.showHeader ? headerEl.classList.remove("zen-hide") : headerEl.classList.add("zen-hide");
        if (this.settings.showHeader) headerEl.classList.add("zen-animate");
    };

    FullScreenPlugin.prototype.removeStyles = function (leaf) {
        if (!leaf || !leaf.view || !leaf.view.contentEl || !leaf.view.headerEl) {
            console.warn("ZenMode RemoveStyles: Called with invalid leaf or view components. Aborting style removal for this leaf.", leaf);
            return;
        }

        const viewEl = leaf.view.contentEl;
        const headerEl = leaf.view.headerEl;
        const isGraph = leaf.view.getViewType() === "graph";

        let graphControls;
        if (isGraph && leaf.view.dataEngine && typeof leaf.view.dataEngine.controlsEl !== 'undefined') {
            graphControls = leaf.view.dataEngine.controlsEl;
            graphControls.classList.remove("zen-hide");
        }

        if (leaf.view instanceof obsidian.MarkdownView) {
            const markdownView = leaf.view;

            // Remove 'is-readable-line-width' from all potential editor targets
            if (markdownView.editor && markdownView.editor.editorEl) {
                markdownView.editor.editorEl.classList.remove("is-readable-line-width");
            }
            if (markdownView.contentEl) {
                const cmEditorDiv = markdownView.contentEl.querySelector('.cm-editor');
                if (cmEditorDiv) {
                    cmEditorDiv.classList.remove("is-readable-line-width");
                }
                // Remove from contentEl itself (could have been 'is-readable-line-width' or 'zen-force-readable-preview')
                markdownView.contentEl.classList.remove("is-readable-line-width");
                markdownView.contentEl.classList.remove("zen-force-readable-preview");
            }
        }
        if (viewEl) { // Added viewEl check
            viewEl.classList.remove("zen-generic-readable");
            viewEl.classList.remove("zen-vignette-linear", "zen-vignette-radial", "zen-animate", "zen-noscroll");
        }
        if (headerEl) { // Added headerEl check (though already checked at top)
            headerEl.classList.remove("zen-animate", "zen-hide");
        }
    };

    return FullScreenPlugin;
}(obsidian.Plugin));

var ZenModeSettingTab = /** @class */ (function (_super) {
    __extends(ZenModeSettingTab, _super);
    function ZenModeSettingTab(app, plugin) {
        var _this = _super.call(this, app, plugin) || this;
        _this.plugin = plugin;
        return _this;
    }
    ZenModeSettingTab.prototype.display = function () {
        var _this = this;
        var containerEl = this.containerEl;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Zen Mode Settings" });

        const applyStylesIfActive = () => {
            const isDomActive = document.body.classList.contains('obsidian-zen-mode-active');
            if ((_this.plugin.isZenModeActive || isDomActive) && _this.plugin.activeLeafWhenZenModeStarted && _this.plugin.activeLeafWhenZenModeStarted.view) {
                console.log("ZenMode Settings: Applying styles. Plugin active:", _this.plugin.isZenModeActive, "DOM active:", isDomActive);
                _this.plugin.setCssVariables();
                _this.plugin.removeStyles(_this.plugin.activeLeafWhenZenModeStarted);
                _this.plugin.addStyles(_this.plugin.activeLeafWhenZenModeStarted);
            } else {
                console.log("ZenMode Settings: Not active or no active leaf, only setting CSS variables.");
                _this.plugin.setCssVariables();
            }
        };
        
        containerEl.createEl("h3", { text: "Vignette" });
        var vignetteOpacityNumber;
        new obsidian.Setting(containerEl)
            .setName('Opacity')
            .setDesc("Intensity of vignette's dimming effect. Set to 0 to turn vignetting off.")
            .addSlider(function (slider) { return slider
            .setLimits(0.00, 1, 0.01)
            .setValue(_this.plugin.settings.vignetteOpacity)
            .setDynamicTooltip()
            .onChange(async function (value) {
                vignetteOpacityNumber.innerText = " " + value.toFixed(2);
                _this.plugin.settings.vignetteOpacity = value;
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); })
            .controlEl.createDiv({ cls: "setting-item-control-meta" }, function (el) {
            vignetteOpacityNumber = el;
            el.style.minWidth = "2.3em";
            el.style.textAlign = "right";
            el.innerText = " " + _this.plugin.settings.vignetteOpacity.toFixed(2);
        });

        var vignetteScaleLinearNumber;
        new obsidian.Setting(containerEl)
            .setName('Scale in text views')
            .setDesc("Determines how close to the screen's center vignetting spreads from both sides of the screen, as linear gradients (%).")
            .addSlider(function (slider) { return slider
            .setLimits(5, 50, 1)
            .setValue(_this.plugin.settings.vignetteScaleLinear)
            .setDynamicTooltip()
            .onChange(async function (value) {
                vignetteScaleLinearNumber.innerText = " " + value.toString();
                _this.plugin.settings.vignetteScaleLinear = value;
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); })
            .controlEl.createDiv({ cls: "setting-item-control-meta" }, function (el) {
            vignetteScaleLinearNumber = el;
            el.style.minWidth = "2.0em";
            el.style.textAlign = "right";
            el.innerText = " " + _this.plugin.settings.vignetteScaleLinear.toString();
        });

        var vignetteScaleRadialNumber;
        new obsidian.Setting(containerEl)
            .setName('Scale in graph view')
            .setDesc("Determines how close to the screen's center vignetting spreads from borders of the screen, as a radial gradient (%).")
            .addSlider(function (slider) { return slider
            .setLimits(5, 100, 1)
            .setValue(_this.plugin.settings.vignetteScaleRadial)
            .setDynamicTooltip()
            .onChange(async function (value) {
                vignetteScaleRadialNumber.innerText = " " + value.toString();
                _this.plugin.settings.vignetteScaleRadial = value;
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); })
            .controlEl.createDiv({ cls: "setting-item-control-meta" }, function (el) {
            vignetteScaleRadialNumber = el;
            el.style.minWidth = "2.3em";
            el.style.textAlign = "right";
            el.innerText = " " + _this.plugin.settings.vignetteScaleRadial.toString();
        });

        containerEl.createEl("h3", { text: "Animation" });
        new obsidian.Setting(containerEl)
            .setName('Fade-in duration')
            .setDesc('The duration (in seconds) of fade-in animation on entering Zen mode.')
            .addText(function (text) { return text
            .setPlaceholder('e.g. 1.2')
            .setValue(String(_this.plugin.settings.animationDuration))
            .onChange(async function (value) {
                var numValue = parseFloat(value);
                if (isNaN(numValue) || numValue < 0) numValue = DEFAULT_SETTINGS.animationDuration;
                _this.plugin.settings.animationDuration = numValue;
                text.setValue(String(numValue));
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); });

        containerEl.createEl("h3", { text: "Element Toggles" });
        new obsidian.Setting(containerEl)
            .setName("Show header")
            .setDesc("Show the tab's header in Zen mode.")
            .addToggle(function (toggle) { return toggle
            .setValue(_this.plugin.settings.showHeader)
            .onChange(async function (value) {
                _this.plugin.settings.showHeader = value;
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); });
        new obsidian.Setting(containerEl)
            .setName("Show scrollbar")
            .setDesc("Show the scrollbar in Zen mode. If hidden, scrolling is still available.")
            .addToggle(function (toggle) { return toggle
            .setValue(_this.plugin.settings.showScroll)
            .onChange(async function (value) {
                _this.plugin.settings.showScroll = value;
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); });
        new obsidian.Setting(containerEl)
            .setName("Show graph controls")
            .setDesc("Show the graph view's controls in Zen mode.")
            .addToggle(function (toggle) { return toggle
            .setValue(_this.plugin.settings.showGraphControls)
            .onChange(async function (value) {
                _this.plugin.settings.showGraphControls = value;
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); });

        containerEl.createEl("h3", { text: "Misc" });
        new obsidian.Setting(containerEl)
            .setName("Force content centering")
            .setDesc("Center text content in Zen mode, even if 'Readable line length' is off globally.")
            .addToggle(function (toggle) { return toggle
            .setValue(_this.plugin.settings.forceReadable)
            .onChange(async function (value) {
                _this.plugin.settings.forceReadable = value;
                await _this.plugin.saveSettings();
                applyStylesIfActive();
            }); });
    };
    return ZenModeSettingTab;
}(obsidian.PluginSettingTab));

module.exports = FullScreenPlugin;