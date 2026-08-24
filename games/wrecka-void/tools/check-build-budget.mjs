import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
const budgets = {
  initialTransferBytes: 200 * 1024,
  largestJavaScriptBytes: 230 * 1024,
  logoBytes: 50 * 1024,
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : path;
    }),
  );
  return files.flat();
}

const files = await listFiles(distDirectory);
const measurements = await Promise.all(
  files.map(async (path) => {
    const extension = extname(path);
    const size = (await stat(path)).size;
    const compressedSize = [".js", ".css", ".html"].includes(extension)
      ? gzipSync(await readFile(path)).byteLength
      : size;
    return {
      path,
      name: relative(distDirectory, path).replaceAll("\\", "/"),
      extension,
      size,
      compressedSize,
    };
  }),
);

const transferFiles = measurements.filter(({ extension }) =>
  [".html", ".js", ".css", ".webp"].includes(extension),
);
const initialTransferBytes = transferFiles.reduce(
  (total, file) => total + file.compressedSize,
  0,
);
const largestJavaScript = measurements
  .filter(({ extension }) => extension === ".js")
  .sort((left, right) => right.size - left.size)[0];
const logo = measurements.find(({ name }) => name.includes("wreckavoid-logo"));
const shippedPng = measurements.find(({ extension }) => extension === ".png");

const failures = [];
if (initialTransferBytes > budgets.initialTransferBytes) {
  failures.push(
    `Initial transfer ${initialTransferBytes} exceeds ${budgets.initialTransferBytes} bytes.`,
  );
}
if (largestJavaScript?.size > budgets.largestJavaScriptBytes) {
  failures.push(
    `${largestJavaScript.name} is ${largestJavaScript.size} bytes; budget is ${budgets.largestJavaScriptBytes}.`,
  );
}
if (!logo || logo.size > budgets.logoBytes) {
  failures.push(
    logo
      ? `Logo is ${logo.size} bytes; budget is ${budgets.logoBytes}.`
      : "Optimized WreckaVOID logo was not emitted.",
  );
}
if (shippedPng) {
  failures.push(`Unexpected PNG shipped: ${shippedPng.name}.`);
}

console.log(
  JSON.stringify(
    {
      initialTransferBytes,
      initialTransferBudgetBytes: budgets.initialTransferBytes,
      largestJavaScript: largestJavaScript
        ? { name: largestJavaScript.name, bytes: largestJavaScript.size }
        : null,
      logo: logo ? { name: logo.name, bytes: logo.size } : null,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`Budget failure: ${failure}`));
  process.exitCode = 1;
}
