# Voice to text: the engine's library (vendored, 1.3.1)

The files the engine page (`src/engine/engine.mjs`) loads, copied unchanged from npm so the app needs no install step
for them and nothing is looked up at run time. `main/stt-engine.js` serves exactly these names under
`cosmomodel://engine/lib/` (`LIB_FILES`; `tests/stt.test.js` checks this folder holds exactly those, plus this README
and `LICENSES.md`). The import map is fixed in `main/stt-models.js` (`IMPORT_MAP`).

| File | From | 
|---|---|
| `transformers.web.js` | `@huggingface/transformers` 4.3.1, `dist/transformers.web.js` |
| `ort.webgpu.bundle.min.mjs` | `onnxruntime-web` 1.31.0-dev.20260914-8d85527a0, `dist/` |
| `ort-wasm-simd-threaded.asyncify.mjs`, `.wasm` | the same, `dist/` (ONNX Runtime loads them from `wasmPaths` = `/lib/`) |
| `onnxruntime-common/*.js` | `onnxruntime-common` 1.30.0, `dist/esm/` (Transformers.js imports `Tensor` from it) |

These are the versions the prototype (Step 1) measured on the owner's PC. To update: copy the same files from a newer
`npm install @huggingface/transformers` (check what `transformers.web.js` imports and what ONNX Runtime loads from
`/lib/`), update `LIB_FILES` / `IMPORT_MAP` if names change, and test Speak to text on the owner's PC.

sha256 (to check a copy):

```
ad44c6e41ff23fd5b01fa3fe08199a0440a35711dc9f80a31132fcce08fbd432  transformers.web.js
7c93a51e9906b246af505bbfbfa4e5806ebe70a081ab0ca0d34e1180293f4f8d  ort.webgpu.bundle.min.mjs
0966b6105cd936744498aa60df7a22cbd47af3374dbc64a9ab561c08a71e3611  ort-wasm-simd-threaded.asyncify.mjs
49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082  ort-wasm-simd-threaded.asyncify.wasm
97dd81b055a06f61120f09468fe59f046a9262b7b87bf5d05bceb085bf4f5558  onnxruntime-common/backend-impl.js
017ce2ec9dc2021ebc1ef2c4f04e1bc74276c65921b0297e7ed8cc16e640495b  onnxruntime-common/backend.js
0da4c562a49fe147e19320a64cbb456184eb0e6242b1fe69c65c8368c55f3d97  onnxruntime-common/env-impl.js
b2bbd3d3b00a95765713c57cd0f5ef73718ae5b8322e07cb47a43e2accb21f15  onnxruntime-common/env.js
ad23f6d6ce2c99c449031f24a5181f259516c64a9a67428c98a8539b857729bd  onnxruntime-common/index.js
0446814a392c147b5c38ba242d9911ee54002b5d01a8e19fb4895fb8f8a0cdd3  onnxruntime-common/inference-session-impl.js
3ad4271a88edb3d242dc1e0e7bbf66510f9a56eff874c433b3b37f900ac007b1  onnxruntime-common/inference-session.js
9e9dc8678be0ea04575a542894508db355a4f9f2155ac7f4c17a697c5f843382  onnxruntime-common/onnx-model.js
33dc232498753fc9026dfa44c99440cb1a6d29f3e53e1ad2fb8b696705158f06  onnxruntime-common/onnx-value.js
df6fa3cd1813c2d3e588cc07973cfe5ea2ab8647c957168200caa58e51440161  onnxruntime-common/tensor-conversion-impl.js
8c43ec1d061ab71032a1b28f45d85ef95f8d7bd2d4cd71d059e96d83e3a8f422  onnxruntime-common/tensor-conversion.js
cf5606fe23461e01bff59c2d72ac47d74e652548718f1e5fab07a22b441379b4  onnxruntime-common/tensor-factory-impl.js
68b9f4f4573f25012ce8a4f73c9a2cee3a28db91de8bbb0a20ddb08bcba33c4b  onnxruntime-common/tensor-factory.js
20bd5ddb858954cf071bace6c7a6628c8e311433798ec172f4c778bebd81d407  onnxruntime-common/tensor-impl-type-mapping.js
6a749be63055f9d21069566b1515412484a3a03448ca20427c8f8d29328a2843  onnxruntime-common/tensor-impl.js
87d3e07c153616138c2f57846545eea9c47957c714d50c0264696bdc293e6732  onnxruntime-common/tensor-utils-impl.js
7acfdb2f8403ae84b7ae62d55d6eeb01519108be8874337b317b911ed60190cd  onnxruntime-common/tensor-utils.js
721d24a538de5333057bfc423bc00c3453a1c483f4495c857d0a6f9b8f2d330e  onnxruntime-common/tensor.js
9b87e6309a1c502b03558aa94b0a65c8ea1e8eb59cb46090f54f6eacd191b841  onnxruntime-common/trace.js
3e2588c6a5ee7b9755e199eef10c6aa2e777d0366ea47d27953657a5638deeae  onnxruntime-common/type-helper.js
71c36bdc106472438d3f6c865c0e7ffd0f957524dceb0750738c451098c5ef13  onnxruntime-common/version.js
```
