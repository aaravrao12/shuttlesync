// Collects every user-facing English string that goes through t(). Run: node scripts-extract-i18n.mjs
import fs from 'node:fs'
import path from 'node:path'

// Team-only tools stay English (see DECISIONS.md): they are used by the 4-person project team, not by students/teachers/parents.
// Files that hold user-facing copy but do not call t() themselves (their strings are translated where displayed).
export const COPY_FILES = ['lib/studentStatus.ts', 'lib/routePlanner.ts', 'lib/verifyCheckin.ts', 'app/checkin.ts', 'lib/busEngine.ts']
export const EXCLUDE = ['pages/evidence/TestMode.tsx', 'pages/evidence/Baseline.tsx', 'pages/pitch/Pitch.tsx', 'pages/demo/DemoPanel.tsx', 'pages/admin/Setup.tsx']

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, out) : /\.(tsx|ts)$/.test(p) && out.push(p) }
  return out
}
const LIT = /'((?:[^'\\\n]|\\.)+)'|"((?:[^"\\\n]|\\.)+)"/g
export function extract(root = 'src') {
  const keys = new Set()
  for (const file of walk(root)) {
    const rel = path.relative(root, file)
    if (EXCLUDE.includes(rel)) continue
    const src = fs.readFileSync(file, 'utf8')
    if (!/\bt\(|useT\(|translate\(/.test(src) && !COPY_FILES.includes(rel)) continue
    // 1) direct t('...') calls
    for (const m of src.matchAll(/\bt\(\s*(?:'((?:[^'\\\n]|\\.)+)'|"((?:[^"\\\n]|\\.)+)")/g)) keys.add((m[1] ?? m[2]).replace(/\\'/g, "'"))
    // 2) strings stored in arrays/objects and later passed to t(variable): capitalised literals that read like copy
    for (const m of src.matchAll(LIT)) {
      const s = (m[1] ?? m[2]).replace(/\\'/g, "'")
      if (/^[A-Z"“¿]/.test(s) && s.length >= 3 && /[a-z]/.test(s) && !/[=<>{}()]{2}|^https?:|\.(tsx?|css|json)$|^[A-Z][A-Za-z]+[A-Z][a-z]+$|className/.test(s) && (/\s/.test(s) || /^[A-Z][a-z]+$/.test(s)) && !/^(Impact|Barlow|Public|Escape|Content-Type|Cache-Control|POST|GET|Staff|Bus$|Student$)/.test(s) ) keys.add(s)
    }
  }
  return [...keys].sort()
}
if (process.argv[1]?.endsWith('extract-i18n.mjs')) {
  const keys = extract()
  const have = JSON.parse(fs.readFileSync('src/i18n/es.json', 'utf8'))
  const missing = keys.filter(k => !(k in have))
  console.log(`${keys.length} strings, ${missing.length} missing Spanish`)
  if (process.argv.includes('--list')) console.log(JSON.stringify(missing, null, 1))
}
