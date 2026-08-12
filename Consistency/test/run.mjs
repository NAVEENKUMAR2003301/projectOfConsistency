// Test runner.
//
// Two build steps first, because several suites assert against real output
// rather than source text:
//   1. the library bundle, so Node can import modules written for Vite
//   2. the production build, so CSS/bundle checks see what actually ships
//
// Then every *.test.mjs runs in its own process — a crash in one cannot take
// the rest of the suite with it.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { APP_DIR, TEST_DIR, appPath } from './_setup.mjs'

// Vite is invoked through its JS entry rather than the `vite`/`npx` shims:
// on Windows those are .cmd files, which execFileSync cannot launch without a
// shell, and spawning a shell to run a build is worth avoiding.
const VITE = appPath('node_modules', 'vite', 'bin', 'vite.js')

const runVite = (args, label) => {
  process.stdout.write(`${label}… `)
  try {
    execFileSync(process.execPath, [VITE, ...args], { cwd: APP_DIR, stdio: 'pipe' })
    console.log('ok')
  } catch (error) {
    console.log('FAILED')
    console.log(String(error.stdout ?? '') + String(error.stderr ?? ''))
    process.exit(1)
  }
}

if (!existsSync(VITE)) {
  console.log('vite not found — run `npm install` first.')
  process.exit(1)
}

// Suites that only read source files need neither build, but building both
// unconditionally keeps the runner predictable and costs a couple of seconds.
runVite(
  ['build', '--ssr', 'test/_harness/libs.js', '--outDir', 'test/.build', '--logLevel', 'error'],
  'building libs',
)
if (existsSync(appPath('dist', 'index.html'))) {
  console.log('using existing dist/ (delete it to force a rebuild)')
} else {
  runVite(['build', '--logLevel', 'error'], 'building app')
}

const suites = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()

if (suites.length === 0) {
  console.log('No test suites found.')
  process.exit(1)
}

console.log(`\nRunning ${suites.length} suites\n`)

let failed = 0
for (const suite of suites) {
  const name = suite.replace('.test.mjs', '')
  try {
    const out = execFileSync(process.execPath, [join(TEST_DIR, suite)], {
      cwd: APP_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
    })
    console.log(`  ${out.trim().split('\n').pop()}`)
  } catch (error) {
    failed++
    console.log(`  FAIL  ${name}`)
    const output = String(error.stdout ?? '') + String(error.stderr ?? '')
    for (const line of output.trim().split('\n')) console.log(`        ${line}`)
  }
}

console.log(
  failed === 0
    ? `\nAll ${suites.length} suites passed.`
    : `\n${failed} of ${suites.length} suites failed.`,
)
process.exit(failed === 0 ? 0 : 1)
