import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(
  new URL("../../../dist/TankaVOID", import.meta.url),
);
const budgets = {
  initialTransferBytes: 120 * 1024,
  largestJavaScriptBytes: 260 * 1024,
};
const initialExtensions = new Set([
  ".html",
  ".js",
  ".css",
  ".svg",
  ".png",
  ".webp",
  ".avif",
  ".woff2",
]);
const forbiddenDownloadedMedia = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".mp4",
  ".webm",
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? listFiles(path) : path;
      }),
    )
  ).flat();
}

const files = await listFiles(distDirectory);
const measurements = await Promise.all(
  files.map(async (path) => {
    const extension = extname(path).toLowerCase();
    const contents = await readFile(path);
    return {
      name: relative(distDirectory, path).replaceAll("\\", "/"),
      extension,
      size: (await stat(path)).size,
      compressedSize: [".html", ".js", ".css", ".svg"].includes(extension)
        ? gzipSync(contents).byteLength
        : contents.byteLength,
      text: [".html", ".js", ".css"].includes(extension)
        ? contents.toString("utf8")
        : "",
    };
  }),
);

const initialTransferBytes = measurements
  .filter(({ extension }) => initialExtensions.has(extension))
  .reduce((total, file) => total + file.compressedSize, 0);
const largestJavaScript = measurements
  .filter(({ extension }) => extension === ".js")
  .sort((left, right) => right.size - left.size)[0];
const shippedMedia = measurements.filter(({ extension }) =>
  forbiddenDownloadedMedia.has(extension),
);
const externalRuntimeReferences = measurements.filter(({ text }) =>
  /(?:url\(|src=)["']?https?:\/\//i.test(text),
);
const failures = [];

if (initialTransferBytes > budgets.initialTransferBytes)
  failures.push(
    `Initial transfer ${initialTransferBytes} exceeds ${budgets.initialTransferBytes} bytes.`,
  );
if (
  !largestJavaScript ||
  largestJavaScript.size > budgets.largestJavaScriptBytes
)
  failures.push(
    largestJavaScript
      ? `${largestJavaScript.name} is ${largestJavaScript.size} bytes; budget is ${budgets.largestJavaScriptBytes}.`
      : "No JavaScript bundle was emitted.",
  );
if (shippedMedia.length > 0)
  failures.push(
    `Unexpected downloaded media shipped: ${shippedMedia.map(({ name }) => name).join(", ")}.`,
  );
if (externalRuntimeReferences.length > 0)
  failures.push(
    `External runtime assets found in: ${externalRuntimeReferences.map(({ name }) => name).join(", ")}.`,
  );

console.log(
  JSON.stringify(
    {
      initialTransferBytes,
      initialTransferBudgetBytes: budgets.initialTransferBytes,
      largestJavaScript: largestJavaScript
        ? { name: largestJavaScript.name, bytes: largestJavaScript.size }
        : null,
      largestJavaScriptBudgetBytes: budgets.largestJavaScriptBytes,
      shippedMediaFiles: shippedMedia.length,
      externalRuntimeAssetFiles: externalRuntimeReferences.length,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`Budget failure: ${failure}`));
  process.exitCode = 1;
}
