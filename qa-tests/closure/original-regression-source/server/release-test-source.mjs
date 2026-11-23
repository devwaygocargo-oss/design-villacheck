// Current release tests use the immutable deployed source, never vanished /tmp trees.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const releaseManifestPath=process.env.VILLACHECK_SECURITY_SOURCE_MANIFEST||'reports/phase1-closure-20261106/manifest.json';
export const releaseManifest=JSON.parse(fs.readFileSync(releaseManifestPath));
export function releaseFile(file){const record=releaseManifest.files.find(f=>f.file===file);assert(record,'Unmanifested release file '+file);const path=releaseManifest.artifact+'/'+file;assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),record.sha256,'Release source drift '+file);return path;}
export const releaseImport=file=>import(pathToFileURL(releaseFile(file)));
