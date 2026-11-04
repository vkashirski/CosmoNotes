# CosmoNotes – version history

The app shows no version history (since 1.1.41): it lives only here and in [`CHANGELOG-archive.md`](CHANGELOG-archive.md).
Settings → About CosmoNotes shows the version, the date of the last update and the feature list.

This file keeps only the **two newest versions**. Older ones (1.2.3 back to 1.0.0) are in the archive. When a new
version is added at the top, move the oldest one here to the top of the archive.

**Renumbered in 1.1.41.** Six big versions were split into smaller ones, so the numbers from 1.1.13 on moved up. Each
heading says what it was. Version numbers written before 1.1.41 (in code comments, test file names such as
`tests/v1131.test.js`, `ai-context/`, and the text of older entries) are the old ones (tests are named by area since 1.1.49):

| Old number | New number |
|---|---|
| 1.0.0 – 1.1.12 | the same |
| 1.1.13 | 1.1.13 and 1.1.14 |
| 1.1.14 | 1.1.15 |
| 1.1.15 | 1.1.16 and 1.1.17 |
| 1.1.16 | 1.1.18, 1.1.19 and 1.1.20 |
| 1.1.17 – 1.1.19 | 1.1.21 – 1.1.23 |
| 1.1.20 | 1.1.24 and 1.1.25 |
| 1.1.21 | 1.1.26 |
| 1.1.22 | 1.1.27, 1.1.28 and 1.1.29 |
| 1.1.23 | 1.1.30, 1.1.31 and 1.1.32 |
| 1.1.24 – 1.1.31 | 1.1.33 – 1.1.40 (old + 9) |

## 1.3.1 – 4 November 2026

Voice to text, offline: + Add → **Speak to text**, right-click a voice note → **Transcribe**, and Settings → **Voice to text**.

- The owner's pick: there is no 1.3.0. Step 3 of `claude/voice-to-text-1.3.1-planning.md` (Project doc); the prototype
  (Step 1, `tools/stt-prototype/`) chose Moonshine Base q8 for **Standard** (comes with the app, ~64 MB) and Whisper
  small.en for **Best** (a download). Nothing ever goes to the cloud; CosmoNotes itself only goes online when you press
  Download for Best (and build.bat, for Standard).
- **The engine** (`main/stt-engine.js`): one hidden window, made on first use and closed after 3 idle minutes, runs
  Transformers.js 4.3.1 (vendored unchanged in `src/engine/lib/`, with a fixed import map: no scanning at run time).
  Its page, library and models come only from `cosmomodel://engine/` on its own in-memory session: a fixed list of
  files, COOP/COEP on every answer (multi-threaded WASM), a strict CSP (no `blob:`, the import map by its hash), no
  permissions, no navigation, and every other request blocked. The note windows' CSP is unchanged.
- **Speak to text** (`src/note/speech.js`, a new note part, 7 of 11) is the voice recorder with a second path: the same
  recording goes to disk as in 1.2.4 (the safety net), and an AudioWorklet (`src/mic-worklet.js`) sends 16 kHz pieces
  to main, then to the engine. The bar says "Listening…" with Stop and Cancel. Words go where the caret was: grey drafts
  while you talk, then the settled text (one Undo step per piece). The marker and the drafts are only attributes, never
  saved. **Stop** finishes what was heard ("Finishing…"), then the clip is deleted. **Cancel**, an error, closing or
  locking the note: the text so far stays, and the recording stays as a voice note where the text was. Esc = Stop.
  One Speak to text at a time ("Voice to text is busy in another note.").
- **Transcribe**: the text goes on the line after the chip, in `<span class="stt-text" data-of="<clip>">` (no look of
  its own), one Undo step. Again on the same chip: "Replace the text from last time? Changes you made to it will be
  lost." Closing or locking the note while it runs: nothing is added. Main reads the clip (a sealed one through
  `attachmentBytes`) and checks that it belongs to that note.
- **Live or after you stop**: Test my computer runs a bundled 12.8 s clip (`src/engine/test-clip.wav`) through each
  model on this PC: ≥ 2× Live, 0.5–2× After you stop, below Too slow. Never tested: a quiet 2-second check the first
  time. A slow PC: "This PC is slow for live text. The words appear when you stop." More than 5 s behind: the drafts
  stop and the words come at Stop.
- **Models** (`main/stt-models.js`, one fixed list: files at a fixed Hugging Face commit with size and sha256). Standard:
  `build.bat` fetches it into `build/models/` (`build/fetch-model.js`, every hash checked); the installer packs it into
  `resources/models/`. Best: Settings → Download puts it in `<data>/models/whisper-small-en/` (`.part` → hash → rename,
  `ready.json` last). Only the set this PC will use is downloaded (decided here, the plan left it open): the graphics
  card's (563 MB) when WebGPU works, else the processor's (int8, 242 MB). Cancel leaves nothing; a failed download keeps
  the good files for Try again; Remove deletes the folder. Not in backups; the uninstaller leaves it. Best picked but
  not there: "This model isn't downloaded yet." and Standard is used. Best on the graphics card that fails to start:
  Standard is used, and Settings says so.
- Memory trim tried (decision of the plan: keep it only if speed holds): ONNX Runtime's CPU memory arena off saved
  nothing and was slower here, so it is not used. The thread count stays ONNX Runtime's own choice.
- Checked in the cloud workspace with the real Moonshine Base model in Chromium (no graphics card there): the engine page
  loads under its CSP, Transcribe of the 37 s sample is word for word, live drafts and finals arrive, all through the
  real main process. Only a real Windows PC can confirm the microphone, the graphics card (Best) and the installer.
- New texts: "Speak to text", "Listening…", "Writing it down…", "Writing it down… 40%", "Finishing…", "Writing it down
  when you stop", "Transcribe", the toasts above, "Couldn't write it down.", "No words found in this recording.",
  Settings → Voice to text.
- Tests: `stt.test.js` (new area: a stub engine for the jobs, the queue, close / lock / crash, the model choice and
  fallback, live or after Stop, Test my computer, `cosmomodel://` refusing `..` and unknown names, the engine session,
  the download against a local server with hash checks, Cancel, Try again, Remove, `.part` cleanup; the live session
  logic under Node); `note-ui` (Speak to text and Transcribe in Chromium: marker, drafts never saved, Undo, Stop, Cancel,
  failure, busy, close, lock, Replace, paste). `code-structure` knows the new part and the engine's preload.
- `tools/stt-prototype/` can be deleted once Speak to text works on the owner's PC (its code now lives in the app).

## 1.2.4 – 3 November 2026

Voice recordings are saved while you talk. Closing the note, locking it, quitting or a crash keeps what was recorded.

- Before, the note window kept a recording in memory until Save. Closing the note, a crash or a power cut lost it, and
  locking the note threw it away. Now each 250 ms piece goes to main and is written to `attachments/<name>.part` at
  once, next to `<stem>.rec.json` (`{ noteId, file, startedAt, endedAt }`: whose recording it is). Save renames the
  `.part` file; the `.rec.json` goes once the note points at the file (`main/recordings.js`).
- Closed mid-recording: the chip goes into the note's last save (beforeunload), and main finishes the file. Locked
  mid-recording ("Lock again", the lock button, or locked from the list): the same, before the window hides. If the
  window can't save any more, or its page crashed, main adds the chip at the end of the note itself.
- Quitting finishes any recording still running (`will-quit`, before the last save of all notes).
- A crash: at the next start, every recording left behind gets its chip at the end of its note, before any window opens.
  A note that was deleted gets a new closed note, "Recovered recording". An empty one is just removed.
- A locked note that is still sealed at start (PIN not typed yet): its clip is sealed at once (`crypt.sealLoose`), and
  its chip arrives after the PIN (`retryPending`, run by `notifyList`). It waits across restarts if needed.
- The sweep never deletes a file that has a `.rec.json` next to it. The unfinished `.part` file can't be served or
  opened (only finished attachment names are).
- If main can't write the file, the window still keeps every piece in memory and saves it the old way at the end.
- **Esc now saves a recording** (before, it threw it away). Only the X throws a recording away.
- Docs: the owner is a programmer, so `CLAUDE.md` and `CONTEXT.md` no longer say otherwise. Technical detail is fine;
  texts inside the app stay short and plain.
- Tests: `recordings.test.js` (new: Save, the X, another window, close, page crash, lock, sweep, quit, a real crash
  and the next start, a deleted note, a locked note sealed until the PIN, across restarts); `note-ui` (the recorder
  in Chromium with a fake microphone: pieces sent while recording, Save, X, Esc, close, lock, the in-memory fallback).
- Only a real Windows PC can check the microphone itself.
