#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'state_resources');
const OUTPUT = path.resolve(__dirname, 'state-resource-files.js');

function getDirectoryEntries(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath, { withFileTypes: true });
}

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildData() {
  const result = {};
  const entries = getDirectoryEntries(ROOT);
  entries
    .filter((entry) => entry.isDirectory())
    .forEach((dir) => {
      const dirName = dir.name;
      const slug = toSlug(dirName);
      const files = getDirectoryEntries(path.join(ROOT, dirName))
        .filter((entry) => entry.isFile())
        .map((file) => ({
          name: file.name,
          path: `./state_resources/${dirName}/${file.name}`
        }));
      result[slug] = files;
    });
  return result;
}

function writeOutput(data) {
  const body = JSON.stringify(data, null, 2);
  const content = `(function(root){\n  root.STATE_RESOURCE_FILES = ${body};\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
  fs.writeFileSync(OUTPUT, content);
}

writeOutput(buildData());
