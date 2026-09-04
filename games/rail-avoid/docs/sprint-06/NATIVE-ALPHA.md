# Native-alpha correction pass

## Authorization and status

The user explicitly authorized GPT Image 1.5 through the bundled imagegen CLI/API for transparent assets, using configured paid API credits. No repeated model/spend approval is needed for this scoped pass. This is not deployment authorization.

Credential preflight initially found no key. The user subsequently configured OPENAI_API_KEY in the Windows user environment, and the native-alpha API request succeeded after loading it into the child process. No credential values are recorded here. Do not put credentials into prompts, source files, logs or chat.

Preparation verified: the bundled CLI dry-run accepted the exact GPT Image 1.5 edit request with `background=transparent`; Python SDK dependencies are cached by uv. The new verifier rejected the known opaque checkerboard export and accepted the existing conductor combat avatar structurally. Light/dark inspection of the conductor showed a clean silhouette, including the gap between the legs, so that existing avatar does not require regeneration in this pass. Unit suite remains 32 passed, one skipped.

The existing v2 enemy exports are rejected drafts. They must not be used as evidence of native transparency. Do not run the former checkerboard-extraction workflow.

## Completed correction and model audit

All eight v3 native PNGs passed alpha and light/dark silhouette inspection, then were encoded into 480x600 runtime WebPs. No background-color keying, checker removal or alpha-mask reconstruction was used. Production encoding only removes wholly transparent margins, resizes and adds transparent padding. The current runtime files retain 64.1-78.6% fully transparent pixels and zero-alpha corners.

The request path was audited after user concern: every paid edit explicitly passed `--model gpt-image-1.5 --background transparent --output-format png`. The bundled CLI forwards `args.model` directly to `client.images.edit`; the edit path contains no model-switching fallback. No custom API base URL was configured and no rate-limit errors were observed. Eight final images required twelve successful edits total: one Hound framing correction and three shadow-removal corrections. An earlier WebP upload was rejected for MIME type before generation. Failed visual variants are retained in the ignored `output/imagegen/rejected/` folder.

Cream and navy review images are deliberate opaque QA composites, not deliverable sprites. The native PNGs and runtime WebPs contain actual transparency. Always label preview backgrounds when showing them to avoid confusing them with asset backgrounds.

Current source/runtime checksums: `NATIVE-ALPHA-HASHES.json`. Final prompt set: `native-alpha-prompt.txt`, with `remove-shadow-prompt.txt` used only for the Brute, Fusilier and Sentinel correction. No new generation was needed for the existing conductor combat sprite, which passed light/dark review.

## Bounded sequence

1. Correct the Void Hound first as the proof case: it has a conspicuous enclosed background pocket between its legs.
2. Inspect native alpha and light/dark contact sheets before continuing.
3. Correct the remaining seven enemies independently using the same identity-preserving prompt.
4. Preserve original RGBA PNG outputs under `output/imagegen/native-alpha/`. Encode accepted runtime siblings as `public/art/enemies/<name>-v3.webp`, retaining alpha without keying or mask reconstruction.
5. Update runtime imports only after all native outputs pass both automated and visual inspection. Check the conductor combat avatar too; its existing alpha channel is not proof of clean edges.
6. Rerun unit, build, standalone and focused encounter/expedition gates. Keep release blocked until visual review is complete.

## Bundled CLI recipe

Run from the game directory with the credential already configured securely. First add `--dry-run` to validate without a paid request; remove it only for the actual correction.

```powershell
uv run --with openai --with pillow --python 'C:/Users/palli/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'C:/Users/palli/.codex/skills/.system/imagegen/scripts/image_gen.py' edit --model gpt-image-1.5 --image tmp/imagegen/native-inputs/void-hound-v2.png --prompt-file docs/sprint-06/native-alpha-prompt.txt --input-fidelity high --background transparent --quality high --size 1024x1024 --output-format png --out output/imagegen/native-alpha/void-hound-v3.png --no-augment
```

Repeat the direct bundled CLI command for each subject below, substituting only input and output filenames. Do not create a replacement API runner.

Windows upload note: the first WebP request was rejected with `unsupported_file_mimetype` because it was labeled `application/octet-stream`. Lossless PNG copies in `tmp/imagegen/native-inputs/` solve that transport issue without changing the pixels or alpha. Use square output for the wide Hound/Crawler silhouettes and portrait output for upright characters. The first portrait Hound output had valid native alpha but cropped extremities; it is preserved in `output/imagegen/rejected/void-hound-v3-cropped.png` and is not a runtime asset.

| Subject | Input | Native output |
| --- | --- | --- |
| Void Hound | void-hound-v2.webp | void-hound-v3.png |
| Void Shade | void-shade-v2.webp | void-shade-v3.png |
| Lantern Wraith | lantern-wraith-v2.webp | lantern-wraith-v3.png |
| Rail Thug | rail-thug-v2.webp | rail-thug-v3.png |
| Scrap Brute | scrap-brute-v2.webp | scrap-brute-v3.png |
| Ash Cult Fusilier | ash-cult-fusilier-v2.webp | ash-cult-fusilier-v3.png |
| Rail-Maw Crawler | rail-maw-crawler-v2.webp | rail-maw-crawler-v3.png |
| Iron Sentinel | iron-sentinel-v2.webp | iron-sentinel-v3.png |

## Acceptance

Run `node verify/native-avatar-check.mjs` for the complete set, or pass one or more PNG paths for a proof case. The tool checks the actual source alpha, rejects opaque/full-frame images, reports content bounds, and creates separate light/dark previews without modifying source images. Automated PASS is structural only: manually inspect internal holes, chain links, spectral edges and full-body framing. Reject and correct with native generation if defects remain; do not color-key.
