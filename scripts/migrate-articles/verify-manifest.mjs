import fs from "node:fs";
import path from "node:path";

import { validateManifest } from "./manifest.schema.mjs";

const manifestPath = path.join(
  process.cwd(),
  "scripts/migrate-articles/manifest/stn-migration.v1.json",
);
const records = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const result = validateManifest(records);

if (!result.ok) {
  console.error(`MANIFEST INVALID:\n${result.errors.join("\n")}`);
  process.exit(1);
}

console.log(
  `OK: manifest valid (${records.length} records, ${
    records.filter((record) => record.include).length
  } included)`,
);
