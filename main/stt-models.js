'use strict';
// 1.3.1: voice to text. The models, as one fixed list: each one's files at a fixed Hugging Face commit, with their size
// and sha256 (copied from the prototype's models.lock.json, Step 1). Changing models = editing this list only.
// - Standard (Moonshine Base, q8 = the "_quantized" files) comes with the app: build.bat downloads it into build/models/
//   (build/fetch-model.js checks every hash) and the installer packs it into resources/models/.
// - Best (Whisper small.en) is downloaded on request into <data>/models/<id>/ (main/stt-download.js): the set for the
//   graphics card when WebGPU works, else the processor's (int8). ready.json there says which set it is.
// Macedonian later: a multilingual Whisper is one more entry here (languages: ['mk']).
const fs = require('fs');
const path = require('path');
const { S } = require('./state');

const HF = 'https://huggingface.co';
const f = (p, size, sha256) => ({ path: p, size, sha256 });

const MODELS = [
  {
    id: 'moonshine-base',
    level: 'standard',
    name: 'Standard',
    family: 'moonshine',
    languages: ['en'],
    builtIn: true,
    repo: 'onnx-community/moonshine-base-ONNX',
    commit: 'b1e9b6aae3c3c7298f10c3798393fdf38e8fbbad',
    common: [
      f('config.json', 922, 'fab7241d1e9fc6c2370c4c6dfb5da79bb54d67ed9ab6b507ac51d29d2abe01d1'),
      f('generation_config.json', 147, 'f9b3f711b57be7def2e50a8942f64f36ee0a55fad5b84ff93a687b6c5bcc1d44'),
      f('preprocessor_config.json', 128, 'fa43a7017ef85cd1d0fba0d9aae77c8adb16990ae6f11115631f41ec5d8aa679'),
      f('special_tokens_map.json', 3, 'ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356'),
      f('tokenizer.json', 3761754, '7b913404bdd039af4756783218af4440bc07fb7d6d8258d677e34f95b3ec416f'),
      f('tokenizer_config.json', 135735, 'edaee394565d428ea98a663ae7209cdcfeefc5585c42d7a570ff7c986df2cd15'),
    ],
    // Moonshine always runs on the processor: the graphics card made it no faster (prototype, Step 1)
    runs: [{
      name: 'cpu',
      device: 'wasm',
      dtype: 'q8',
      files: [
        f('onnx/encoder_model_quantized.onnx', 20513063, '1dd9ab0a7f987113d30affcba5a068d11c8f90fa0223caa3e491ade431ad9751'),
        f('onnx/decoder_model_merged_quantized.onnx', 42498870, 'cc9f3cd6698a369c6008b41aa60aa3fb3322e7f03c9bdf19d8e6b7200afca4f3'),
      ],
    }],
  },
  {
    id: 'whisper-small-en',
    level: 'best',
    name: 'Best',
    family: 'whisper',
    languages: ['en'],
    builtIn: false,
    repo: 'onnx-community/whisper-small.en',
    commit: '482fb8ba081b6e906f92efe103622316b2a0cc69',
    common: [
      f('added_tokens.json', 34604, '560be47bea388757f8d4cc185c5d82067426cbb6361e38016dd90ddc01ab203a'),
      f('config.json', 2203, '8825c4174cb86f94d9fa67614942f8aa17bfbbdf2fae5426d4adfd0bc5893c43'),
      f('generation_config.json', 1956, '5490747ca976d6b3765280a0697d66489020c2afa6e754244d9cd093e1639331'),
      f('merges.txt', 456318, '1ce1664773c50f3e0cc8842619a93edc4624525b728b188a9e0be33b7726adc5'),
      f('normalizer.json', 52666, 'bf1c507dc8724ca9cf9903640dacfb69dae2f00edee4f21ceba106a7392f26dd'),
      f('preprocessor_config.json', 339, 'a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d'),
      f('quantize_config.json', 10126, '6e0e27f293a5c17ff2ca8046f06079c0120aa2ede6456faac8ec4b3203471a55'),
      f('special_tokens_map.json', 2173, '98bdf3ec5b32e31575b02f64b0a32bde7c0449075d34484a7df9bdd3cdeb9fb9'),
      f('tokenizer.json', 2405679, '5eb60cec1e77aeeb6869a2bb5a8e01a84c3fe5d072d75369343021fe6f5310d0'),
      f('tokenizer_config.json', 282662, '93879c3dccdd4b976f709acd85b44778873f30c275e67026f30ca1e4c975230c'),
      f('vocab.json', 999186, 'f6bd25a65e4e63ca31360e9fb11c7e4f9a391a78385d640acd814092dd6eee4f'),
    ],
    // the first run that this PC can use is downloaded (gpu needs WebGPU)
    runs: [
      {
        name: 'gpu',
        device: 'webgpu',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        needs: 'webgpu',
        files: [
          f('onnx/encoder_model.onnx', 352825870, '695836adae236d456605813b548bdab33df8924587e2252d7eba01cdfeb015b3'),
          f('onnx/decoder_model_merged_q4.onnx', 233146255, '86a8c61d69876771dda2717b6f7037deb4f55dbc54fac9d6c13520036e4ba88f'),
        ],
      },
      {
        name: 'cpu',
        device: 'wasm',
        dtype: 'int8',
        files: [
          f('onnx/encoder_model_int8.onnx', 92326127, '0a143c26b5aa5f549bef89a9363a56a5610a00985afe1e56443a71852bd642d4'),
          f('onnx/decoder_model_merged_int8.onnx', 156750076, '29132c41903c252d0f2b9e59ee1e7d75f7d0b64d37f3e36d1ecc4a1a1af62953'),
        ],
      },
    ],
  },
];
const STANDARD = MODELS[0].id;

// The engine page's library (src/engine/lib/, vendored from Transformers.js 4.3.1 and ONNX Runtime Web, see the README
// there): the only files served under cosmomodel://engine/lib/. The import map in the engine page points at these.
const LIB_DIR = path.join(__dirname, '..', 'src', 'engine', 'lib');
const BUILD_DIR = path.join(__dirname, '..', 'build', 'models'); // build.bat puts Standard here (git-ignored)
const ENGINE_DIR = path.join(__dirname, '..', 'src', 'engine');
const IMPORT_MAP = {
  imports: {
    '@huggingface/transformers': '/lib/transformers.web.js',
    'onnxruntime-web/webgpu': '/lib/ort.webgpu.bundle.min.mjs',
    'onnxruntime-common': '/lib/onnxruntime-common/index.js',
  },
};

const findModel = (id) => MODELS.find((m) => m.id === id) || null;
const runOf = (m, name) => (m && m.runs.find((r) => r.name === name)) || null;
const filesOf = (m, run) => [...m.common, ...run.files];
const bytesOf = (m, run) => filesOf(m, run).reduce((n, x) => n + x.size, 0);

// where the models are (a test can point these somewhere else)
let builtInRoot = null;
function builtInDir() {
  if (builtInRoot) return builtInRoot;
  const { app } = require('electron'); // here, not at the top: build/fetch-model.js reads this list under plain Node
  return app.isPackaged ? path.join(process.resourcesPath, 'models') : BUILD_DIR;
}
const userDir = () => path.join(S.store.root, 'models');
const dirOf = (m) => path.join(m.builtIn ? builtInDir() : userDir(), m.id);
function setBuiltInDir(d) { builtInRoot = d; }

const sizeOk = (p, size) => { try { const st = fs.statSync(p); return st.isFile() && st.size === size; } catch { return false; } };

// The run of a model that is on this PC (its files there, with the right sizes), or null.
// Sizes only: hashes are checked when a file is downloaded (and by build/fetch-model.js).
function installed(m) {
  if (!m) return null;
  let run = null;
  if (m.builtIn) run = m.runs[0];
  else {
    try { run = runOf(m, JSON.parse(fs.readFileSync(path.join(dirOf(m), 'ready.json'), 'utf8')).run); } catch { run = null; }
  }
  if (!run) return null;
  const dir = dirOf(m);
  return filesOf(m, run).every((x) => sizeOk(path.join(dir, ...x.path.split('/')), x.size)) ? run : null;
}

// a model file the engine may read: cosmomodel://engine/models/<id>/<file>. Only the files of the installed set.
function modelFile(id, rel) {
  const m = findModel(id);
  const run = installed(m);
  if (!run || !filesOf(m, run).some((x) => x.path === rel)) return null;
  return path.join(dirOf(m), ...rel.split('/'));
}

module.exports = { BUILD_DIR, ENGINE_DIR, HF, IMPORT_MAP, LIB_DIR, MODELS, STANDARD, builtInDir, bytesOf, dirOf, filesOf, findModel, installed, modelFile, runOf, setBuiltInDir, userDir };
