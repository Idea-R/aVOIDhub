import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import ts from 'typescript';

const root = path.dirname(fileURLToPath(import.meta.url));
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.app.json');
if (!configPath) throw new Error('tsconfig.app.json was not found');

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const sourceRoot = `${path.join(root, 'src')}${path.sep}`;
const activeFiles = program.getSourceFiles()
  .map((sourceFile) => path.resolve(sourceFile.fileName))
  .filter((fileName) => fileName.startsWith(sourceRoot) && /\.(ts|tsx)$/.test(fileName));

const eslint = new ESLint({ cwd: root, errorOnUnmatchedPattern: false });
const results = await eslint.lintFiles(activeFiles);
const formatter = await eslint.loadFormatter('stylish');
const output = formatter.format(results);
if (output) process.stdout.write(output);

const errors = results.reduce((sum, result) => sum + result.errorCount, 0);
const warnings = results.reduce((sum, result) => sum + result.warningCount, 0);
process.stdout.write(`Active graph: ${activeFiles.length} TypeScript files, ${errors} errors, ${warnings} warnings.\n`);
if (errors > 0 || warnings > 0) process.exitCode = 1;
