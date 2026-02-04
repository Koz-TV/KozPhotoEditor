# KozPhotoEditor (MVP)

Minimal, Rams‑inspired image editor focused on **crop**. One shared UI/logic codebase runs on:
- **Web** (Vite build)
- **macOS / Windows** desktop via **Tauri v2** wrapper

## Tech Stack (and why)
- **Tauri v2**: native desktop shell with small binaries and OS dialogs/FS.
- **React + TypeScript**: fast UI iteration with strong typing for math and state.
- **Vite**: quick dev server + optimized web builds.
- **Canvas 2D**: lightweight renderer (no heavy dependencies) suitable for MVP.
- **lucide-react**: minimal icon set.

## Architecture
- `src/core/` — pure math/logic (rect ops, crop resize, history, export pipeline)
- `src/ui/` — React components (canvas view, panels)
- `src/platform/` — Web/Tauri file IO adapters
- `src-tauri/` — desktop wrapper

## Commands

Install:
```bash
npm install
```

Web:
```bash
npm run dev        # dev server
npm run build      # production build
```

Desktop (Tauri):
```bash
npm run dev:desktop    # macOS/Windows dev
npm run build:desktop  # macOS/Windows build
```

Tests (core math):
```bash
npm run test
```

## Implementation Notes

### Crop math
- `resizeCropRect` (`src/core/crop.ts`) handles handles, **Shift** (square), and **Option/Alt** (symmetric around center).
- For square mode, the active edge(s) are adjusted while keeping the anchor edge(s) fixed; symmetric mode keeps the center fixed.
- All crop rects are stored in **image space** (oriented after rotation), not screen space.

### Snapping + Guides
- While moving/resizing, the rect snaps to image **edges**, **center**, and **thirds** within a small threshold.
- Active snap guides are drawn as dashed lines across the image.

### Transform pipeline
- Export uses **crop → rotate → export**, with rects converted back to original image coordinates when rotation is applied.
- See `src/core/transform.ts` and `unrotateRectToOriginal` for the mapping.

### Extending the pipeline
- Add adjustments to `TransformState` in `src/core/types.ts`.
- Apply them in `exportTransformedImage` and render preview overlays in `CanvasView`.

---

**Desktop permissions** are configured in `src-tauri/capabilities/default.json` for dialog + filesystem.

## License
MIT © 2026 Koz-TV
