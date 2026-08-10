import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Runs once before the webServer(s) start. The frontend only ever loads the API's default
// first page (20 records — see the "Known limitation" note in docs/TMS-Documentation.md), so
// a scratch CSV left over from a previous run can silently push a just-created row out of
// view once the file holds 20+ rows, breaking otherwise-correct tests. Deleting the scratch
// directory here guarantees every `npm run test:e2e` invocation starts from an empty file.
export default function globalSetup() {
  const scratchDir = path.resolve(__dirname, '../../backend/target/e2e-data')
  rmSync(scratchDir, { recursive: true, force: true })
}
