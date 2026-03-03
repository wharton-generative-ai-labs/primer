import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Parse current version
const version = packageJson.version;
const prereleaseParts = version.split('-');
const baseVersion = prereleaseParts[0];
const preid = prereleaseParts[1]; // undefined if no preid

const versionParts = baseVersion.split('.');
const [major, minor, patch] = versionParts;

// Increment patch version
const newPatch = parseInt(patch) + 1;
const newVersion = `${major}.${minor}.${newPatch}${preid ? '-' + preid : ''}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

// Output only the version number for the shell script to capture
console.log(newVersion); 