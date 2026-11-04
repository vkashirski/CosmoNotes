# CosmoNotes voice-to-text: plan (3 Nov 2026; revised after the prototype and 1.2.4)

**Status (3 Nov 2026, night):** Step 1 (prototype) **passed**; Step 2 (**1.2.4**, crash-safe recording + the "programmer" wording) is **done and on the owner's PC** (all 24 files verified by sha256; 34/34 test files pass). The owner still has to run `build.bat` for 1.2.4 and try a real recording on his PC (microphone). **Next chat: Step 3 = 1.3.1** (Speak to text + Transcribe + Settings → Voice to text). Keep `tools/stt-prototype/` until 1.3.1 has reused its code, then delete it.

## Read first (next chat)
- `CLAUDE.md` (rules, pitfalls, checklist), then only as needed: `ai-context/CONTEXT.md` (map), `architecture.md` (locks, encryption, IPC, security), `data-model.md` (attachments, sweep, "Voice recordings").
- **The app is at 1.2.4.** The owner is a programmer (the docs say so since 1.2.4): technical detail is fine; texts inside the app stay short and plain.
- Locked notes are **encrypted** (1.1.30, `main/crypt.js`): read a sealed clip only through `attachmentBytes`; every note write goes through `diskForm`.
- Recorder code (1.2.4): `src/note/menus-voice-ink.js` (`rec`, `startRecording`, `stopRecording(keep)`, `stopRecordingNow()`, `finishRecording`, `voiceChip`) and `main/recordings.js` (`start`, `chunk`, `end(mode)`, `done`, `abandon`, `finishAll`, `recover`, `retryPending`, `settle`, `chipHtml`). IPC: `rec:start`, `rec:chunk`, `rec:end` (`save` | `discard` | `kept`), `rec:done` (in `main/ipc-files.js`; preload `recStart/recChunk/recEnd/recDone`).

## Step 2 (1.2.4): what was built
- A recording is on disk while it is made: `attachments/<stem>.webm.part` (each 250 ms MediaRecorder piece appended, fsync every 8) + `attachments/<stem>.rec.json` `{ noteId, file, startedAt, endedAt }`. Save renames the `.part`; the window adds the chip, saves, then `rec:done` removes the `.rec.json` (main adds the chip itself if the note doesn't have it).
- Close mid-recording: `beforeunload` calls `stopRecordingNow()` (chip into the editor) before the sync save; `rec:end 'kept'`. Lock mid-recording: `relock` / `lockNow` call `stopRecordingNow()` before saving; `hideContent` falls back to `rec:end 'kept'` and main adds the chip. Page crash / window closed: `abandon(win)` (win `closed`, wc `render-process-gone`). Quit: `finishAll()` in `will-quit` before `S.store.flush()`.
- Crash: `recover()` at start (main.js, after `installCrypt`, before windows): leftover pairs → chip at the end of the note; deleted note → new closed note "Recovered recording"; empty `.part` → removed. A note still sealed: `crypt.sealLoose(name, n)` seals the clip at once, chip after the PIN (`retryPending()` runs in `notifyList`), waits across restarts.
- `store.sweepAttachments` skips any file whose stem has a `.rec.json`. `.part` names can't be served (`ATT_NAME`).
- The window still keeps every piece in memory; if `rec:start`/`rec:end` fails it saves the old way (`saveAttachment`).
- **Esc now saves a recording** (only the X throws it away). The owner wasn't asked: mention it, revert if he prefers.
- Tests: `tests/recordings.test.js` (new area, 5 parts with real restarts and crashes) and `note-ui.test.js` (the recorder in Chromium with a fake microphone; `nu.open(note, w, h, init)` lets a test answer `window.sticky` calls).

## How 1.3.1 hooks into 1.2.4
- **Speak to text uses the same recorder path**: `rec:start` → the same MediaRecorder pieces go to `rec:chunk` (the file is the safety net), and the AudioWorklet's 16 kHz chunks go note → main → engine. Normal finish = text inserted, then `rec:end 'discard'` (the clip is deleted at once, decision 9). Cancel / close / lock = keep it as a 🎤 voice note: exactly 1.2.4's `stopRecordingNow()` / `kept` path (so decision 3 is mostly built already). Grey drafts must be removed before that chip goes in.
- **Transcribe** reads the clip in main through `attachmentBytes` and sends the bytes to the engine (the prototype's `decode` in `engine/engine.js` already takes bytes).
- `voiceChip` (window) and `chipHtml` (main) must stay the same markup.

## Step 1 results (owner's PC: Ryzen 5 9600X 6c/12t, 31 GB, NVIDIA Blackwell; Electron 39.8.10 / Chrome 142)
- **Offline: PASS** (801 requests to our protocol, 0 internet). **Smart App Control: no warning.** **Start-up: 1.2–2.5 s** (engine window + model). **The AudioWorklet loads from file:// in Electron** under the note CSP. Engine page cross-origin isolated, SharedArrayBuffer yes, ORT used 4 threads; v4 loads `ort-wasm-simd-threaded.asyncify.mjs` from `/ort/`. No CSP reports (`blob:` is not needed in the engine CSP).
- Speed on the Windows-voice sample (37 s; × real time), errors (WER), engine RAM (+ GPU process):
  - Tiny: cpu-int8 41× **82 % errors (broken quantization)**, cpu-q8 37× 0 %, cpu-fp32 38× 0 %, gpu 22× 0 % (808 + 370 MB).
  - Base: cpu-int8 16× 1.1 %, **cpu-q8 21× 0 % (729 MB)**, gpu 22× 0 % (955 + 428 MB).
  - Whisper small.en: cpu-int8 4.5× 1.1 % (1274 MB), gpu 14× 1.1 % (2376 + 579 MB). Live on CPU only 1.2–1.6× (short pieces are padded to 30 s), as predicted.
- **The GPU does not help Moonshine** (slower or equal, 2× the memory); only Whisper gains ~3×.
- Owner: "Moonshine Base cpu-q8 was the best, fast enough and precise enough." "1, 2, 3" → "one to three" is a Moonshine habit; Whisper writes digits.
- Sizes (pinned commits + sha256 per file in `tools/stt-prototype/models.lock.json`): Base q8 = enc 19.6 + dec 40.5 + configs 3.7 ≈ **64 MB** (commit b1e9b6aae3c3); Whisper small.en int8 ≈ **242 MB**; its GPU set (enc fp32 336.5 + dec q4 222.3) ≈ 563 MB (commit 482fb8ba081b).
- Import map: the runtime regex scan logged harmless false positives from strings in minified code; only 3 real entries. **In 1.3.1, vendor the needed files and write the import map once (fixed); no runtime scanning.**

## Owner's decisions after the prototype (override the older points below)
- **One built-in model: Moonshine Base q8** (in the installer, ~64 MB). **Tiny is dropped.** If "Test my computer" or the first-use check finds a PC too slow for live text, show a short note and write the text when the user stops.
- **q8 (`_quantized` files), not int8,** for Moonshine. Whisper int8 is fine.
- **GPU only for Whisper** (Moonshine always on the processor). No preference from the owner; recommended default.
- **Memory: accept** ~650–750 MB while in use (freed 3 min after last use); in 1.3.1 try cheap trims (thread count, CPU memory arena off), keep them only if speed holds. No preference from the owner; recommended default.
- Settings has two levels: **Standard** (Moonshine Base, built in) and **Best** (Whisper small.en, download). Open for 1.3.1: download only the set the PC will use (GPU set 563 MB if WebGPU works, else int8 242 MB), or always int8.

## Prototype code to reuse (`tools/stt-prototype/`)
- `fetch-models.js`: HF API `/api/models/<repo>/revision/<rev>?blobs=true`, pinned commit, sha256 (LFS) / git blob sha1 checks while downloading, `.part` → rename. Reuse for `build.bat` (Standard) and the Best download in main.
- `main.js`: `cosmomodel://engine/` via `ses.protocol.handle` on an in-memory partition (`/`, `/engine*.js`, `/lib/`, `/ort/`, `/models/`), COOP/COEP/CORP on every response, CSP with the import map's sha256, permissions denied, navigation blocked, idle close after 3 min, webRequest blocks + logs http/https/ws.
- `engine/engine.js`: `allowRemoteModels=false`, `localModelPath='/models/'`, `useBrowserCache`/`useWasmCache` off, `wasmPaths` = `/ort/`, `env.fetch` refuses other origins, `decode` (OfflineAudioContext at 16 kHz).
- `engine/engine-core.js` (Node-tested): live session (0.6 s pause ends a piece; 20 s max; grey draft ~1 s; one final pass; >5 s behind → drafts stop, text held until Stop), auto threshold = max(slider, min(3 × quietest chunk of the last 8 s, 0.04)), `splitAtPauses`, `cleanText`, WER.
- `ui/mic-worklet.js`: AudioWorklet, 16 kHz 0.25 s chunks + RMS (box-filter downsampling when the context isn't 16 kHz). Goes to `src/` in 1.3.1.

## Goal and fixed choices
- Speech-to-text that is free, **offline only** (no cloud, not even opt-in), works on weak laptops. English first. **Macedonian later must be easy** (models come from a list; multilingual Whisper later).
- **Route:** Transformers.js 4.x (ONNX Runtime Web, WASM / WebGPU) inside CosmoNotes. No native add-ons or helper .exe. **Never modify `CosmoNotes.exe`.**
- Two features: **+ Add → "Speak to text"** (words only) and **right-click a 🎤 chip → "Transcribe"** (the chip stays; text goes on the line after it). No new bottom-bar button. Only while the note is **unlocked and open**.

## Decisions (planning round; revised where marked)
1. **Engine:** one shared, hidden **engine window** owned by main, created on first use, closed after a few idle minutes. Own strict CSP, a narrow `engine:*` preload, `hardenContents`, navigation blocked. **The note window's CSP stays as it is.** The microphone stays in the note window. Audio goes note → main → engine. Main runs one queue (one job at a time).
2. **Jobs never outlive their note window.** Closing the note, locking it, or stopping/cancelling ends it. Main never writes transcript text into a note: the window inserts it itself. The existing guards (`applyPatch` strips `SECRET` for hidden windows; hidden windows never save) stay untouched.
3. **Stop** = stop listening and finish only the audio already heard ("Finishing…"); in after-Stop mode all the text is written here. **Cancel, close or lock** = abort now: grey draft text is removed, settled text stays, and **the recording is kept as a normal 🎤 voice note** (1.2.4's `kept` path). A normal finish discards the recording. **Transcribe** cancelled by close or lock: nothing is added and the chip is unchanged.
4. **Models (revised):** Standard = **Moonshine Base q8** (in the installer), Best = **Whisper small.en** (download; GPU when WebGPU works, else CPU int8, usually after-Stop). Swapping models = editing the model list only.
5. **Model files:** one fixed list in `main/stt-models.js` (id, family, languages, files at a **fixed Hugging Face commit**, size, **sha256**; copy from `models.lock.json`).
   - Standard: `build.bat` downloads and hash-checks it into `build/models/` (git-ignored); packed via `extraResources` into `resources/models/`.
   - Best: main downloads it on request into `<data>/models/<id>/` (`.part` → hash check → rename). Settings: progress bar, Cancel, Try again, Remove. Not in backups. Uninstall leaves it.
   - The engine reads models only through the read-only `cosmomodel://engine/models/<id>/<file>` (same origin as the engine page, needed under COEP). Only main touches the internet, and only on Download.
6. **GPU/CPU and live mode (revised):** Moonshine always on the CPU (WASM, multi-threaded via COOP/COEP); Whisper on WebGPU when it works, else CPU. Automatic, no setting. **"Test my computer"** runs a bundled English clip through each installed model: **≥ 2× = Live; 0.5–2× = After you stop; < 0.5× = Too slow.** If never run, the first use does a quiet 2-second check during warm-up. Too slow for live → the slow-PC note, text at Stop. Safety net: >5 s behind → live updates stop for that session ("Writing it down when you stop").
7. **Audio:** Speak to text: one mic stream feeds **MediaRecorder** (→ 1.2.4's `rec:chunk` file) and the **AudioWorklet** (`src/`, proven under the note CSP) → 16 kHz chunks note → main → engine. Transcribe: main reads the clip through `attachmentBytes`; the engine decodes it at 16 kHz. Pauses: loudness-based (~0.6 s). Long audio: Moonshine pieces ≤ ~20 s split at pauses; Whisper `chunk_length_s`/`stride_length_s`; marker "Writing it down… 40%"; one Undo step. No length limit.
8. **Crash-safe recording: done in 1.2.4** (see Step 2 above).
9. **Text details:** model punctuation/capitals kept; trim spaces; drop `[BLANK_AUDIO]`, `(music)` and similar tags; silent pieces never sent. Settled text = plain note text. Transcribe output in an invisible `<span class="stt-text" data-of="<clip>">`; transcribing the same chip again asks in the app's pop-up: "Replace the text from last time? Changes you made to it will be lost." (Replace / Cancel). Pending marker `<span class="stt-pending" data-job>`; `cleanTree` strips both `stt-*` classes on paste. Undo: one step per settled piece / per Transcribe result. After a successful Speak to text, the clip is **deleted at once** (`rec:end 'discard'`).
10. **Prototype:** done. Delete `tools/stt-prototype/` after 1.3.1 reuses its code.
11. **Wording (short and plain):**
   - + Add item: "Speak to text". Bar: "Listening…" with Stop / Cancel. Markers: "Writing it down…", "Writing it down… 40%", "Finishing…". Live drafts are grey. Chip menu: "Transcribe".
   - Toasts: "Stopped. Your recording is saved as a voice note." · "Couldn't write it down. Your recording is saved." · the existing microphone message · "This model isn't downloaded yet." (falls back to Standard) · slow PC: "This PC is slow for live text. The words appear when you stop."
   - Settings → **Voice to text**: Standard / Best with size and status (Ready · Download · Downloading 45% – Cancel · Remove); **Test my computer** with Live / After you stop / Too slow per model; "Using: graphics card / processor"; "Best downloads from Hugging Face. Your voice never leaves this PC."
   - About features: "Speak to text: talk, and the words appear in your note. It all stays on this PC." · "Transcribe: right-click a voice note to turn it into text."
   - The same internet-use line goes in `HOW TO INSTALL.txt`.
12. **Tests, docs, release (1.3.1):** a new `tests/stt.test.js` with a **stub engine** (queue, abort on close/lock, clip kept vs deleted, download hash check and `.part` cleanup against a local fake server, `cosmomodel://` refusing `..` and unknown names); `recordings.test.js` / `note-ui` for the recorder side (marker insert, `stt-*` stripped on paste, the Replace pop-up); `code-structure.test.js` covers new `main/` files. Docs: `architecture.md` (engine window, protocol, CSP, import map, job rules), `data-model.md` (`models/`, new settings), `feature-map.md`, `build-and-release.md` (`build.bat` fetches Moonshine Base q8). Full `CLAUDE.md` checklist; the owner runs `build.bat`; verify every file written through the folder bridge.

## Sources
- Transformers.js releases (v4, native WebGPU; 4.3.1 latest): https://github.com/huggingface/transformers.js/releases
- Moonshine: https://github.com/usefulsensors/moonshine
- Moonshine ONNX for Transformers.js (MIT): https://huggingface.co/onnx-community/moonshine-tiny-ONNX (Base: onnx-community/moonshine-base-ONNX)
- Whisper small.en ONNX: https://huggingface.co/onnx-community/whisper-small.en
- Smart App Control (Eric Lawrence): https://textslashplain.com/2026/04/28/smart-app-control/
- Macedonian Whisper fine-tunes (for later): https://huggingface.co/Macedonian-ASR/buki-whisper-2.0 and https://huggingface.co/Macedonian-ASR/whisper-large-v3-macedonian-asr
