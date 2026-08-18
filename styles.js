/**
 * Note styles. They live in a JS string because everything is rendered inside a
 * closed-off shadow root, which a manifest `css` entry cannot reach. Keeping the
 * rules here also means no web_accessible_resources and no unstyled flash.
 */
globalThis.STN_STYLES = `
:host {
  all: initial;
}

.stn-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
}

.stn-note {
  position: absolute;
  box-sizing: border-box;
  min-width: 140px;
  min-height: 110px;
  background: #fff6a9;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  color: #3a3a3a;
  pointer-events: auto;
  touch-action: none;
}

.stn-note.stn-dragging,
.stn-note.stn-resizing {
  opacity: 0.9;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.stn-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 6px 4px 8px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  touch-action: none;
}

.stn-header:active {
  cursor: grabbing;
}

.stn-colors {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.stn-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
  padding: 0;
  margin: 0;
  appearance: none;
}

.stn-color-dot.stn-active {
  outline: 2px solid rgba(0, 0, 0, 0.45);
  outline-offset: 1px;
}

.stn-color-dot:focus-visible,
.stn-delete:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 1px;
}

.stn-delete {
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.45);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  margin: 0;
  border-radius: 3px;
}

.stn-delete:hover {
  background: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.75);
}

.stn-body {
  flex: 1 1 auto;
  padding: 4px 10px 10px 10px;
  outline: none;
  overflow-y: auto;
  overflow-wrap: break-word;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
  -webkit-user-modify: read-write-plaintext-only;
}

.stn-body:empty::before {
  content: attr(data-placeholder);
  color: rgba(0, 0, 0, 0.35);
}

.stn-resize-handle {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  opacity: 0.5;
  touch-action: none;
}

.stn-resize-handle::before {
  content: "";
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid rgba(0, 0, 0, 0.4);
  border-bottom: 2px solid rgba(0, 0, 0, 0.4);
}

.stn-toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  max-width: 280px;
  padding: 10px 14px;
  border-radius: 6px;
  background: rgba(32, 33, 36, 0.94);
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.stn-toast[hidden] {
  display: none;
}
`;
