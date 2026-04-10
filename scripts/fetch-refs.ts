import { $ } from "bun"
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

// ============================================================================ //
//                                    SOURCES                                   //
// ============================================================================ //
const sources = [
  {
    repo: "Blankeos/solid-launch",
    branch: "main",
    dir: "_tmp_solid-launch",
  },
  {
    repo: "Blankeos/solid-powersync-example",
    branch: "main",
    dir: "_tmp_solid-powersync-example",
  },
]

function isNonEmptyDir(dir: string): boolean {
  if (!existsSync(dir)) return false
  try {
    return readdirSync(dir).length > 0
  } catch {
    return false
  }
}

async function gitClone(repo: string, branch: string, subdir: string | undefined, dir: string) {
  const url = `https://github.com/${repo}.git`
  if (subdir) {
    await $`git clone --depth 1 --branch ${branch} --filter=blob:none --sparse ${url} ${dir}`
    await $`cd ${dir} && git sparse-checkout set ${subdir}`
  } else {
    await $`git clone --depth 1 --branch ${branch} ${url} ${dir}`
  }
}

async function gitPull(dir: string) {
  await $`cd ${dir} && git pull`
}

function ensureTsconfigExclude(tsconfigFile: string, pattern: string) {
  if (!existsSync(tsconfigFile)) return
  const text = readFileSync(tsconfigFile, "utf8")
  const quoted = `"${pattern}"`

  // Find top-level "exclude" key. We don't strip comments, but the key
  // itself is unambiguous enough for this simple case.
  const keyMatch = text.match(/"exclude"\s*:\s*\[/)
  if (keyMatch) {
    const arrStart = (keyMatch.index ?? 0) + keyMatch[0].length
    // Find matching closing bracket (no nested arrays expected in exclude).
    let depth = 1
    let i = arrStart
    while (i < text.length && depth > 0) {
      const ch = text[i]
      if (ch === "[") depth++
      else if (ch === "]") depth--
      if (depth === 0) break
      i++
    }
    if (depth !== 0) {
      console.log(`✗ Could not parse ${tsconfigFile} exclude array`)
      return
    }
    const inner = text.slice(arrStart, i)
    if (inner.includes(quoted)) {
      console.log(`✓ ${tsconfigFile} already excludes ${pattern}`)
      return
    }
    const trimmed = inner.replace(/\s+$/, "")
    const hasItems = trimmed.replace(/[,\s]/g, "").length > 0
    const insertion = hasItems
      ? (trimmed.endsWith(",") ? ` ${quoted},` : `, ${quoted}`)
      : quoted
    const next = text.slice(0, arrStart) + trimmed + insertion + text.slice(i)
    writeFileSync(tsconfigFile, next)
    console.log(`✓ Added ${pattern} to ${tsconfigFile} exclude`)
    return
  }

  // No exclude key — insert one before the final closing brace.
  const lastBrace = text.lastIndexOf("}")
  if (lastBrace === -1) {
    console.log(`✗ Could not find closing brace in ${tsconfigFile}`)
    return
  }
  const before = text.slice(0, lastBrace).replace(/\s+$/, "")
  const needsComma = !before.endsWith("{") && !before.endsWith(",")
  const next =
    before + (needsComma ? "," : "") + `\n  "exclude": [${quoted}],\n` + text.slice(lastBrace)
  writeFileSync(tsconfigFile, next)
  console.log(`✓ Added exclude to ${tsconfigFile}`)
}

async function init() {
  const ignoreFile = ".ignore"
  const gitignoreFile = ".gitignore"
  const tsconfigFile = "tsconfig.json"
  const ignoreContent = "!_tmp_*\n"
  const gitignoreContent = "_tmp_*\n"

  if (existsSync(ignoreFile)) {
    const content = await Bun.file(ignoreFile).text()
    if (!content.includes("!_tmp_*")) {
      const prefix = content.length === 0 || content.endsWith("\n") ? "" : "\n"
      appendFileSync(ignoreFile, prefix + ignoreContent)
      console.log(`✓ Appended to ${ignoreFile}`)
    } else {
      console.log(`✓ ${ignoreFile} already configured`)
    }
  } else {
    writeFileSync(ignoreFile, ignoreContent)
    console.log(`✓ Created ${ignoreFile}`)
  }

  if (existsSync(gitignoreFile)) {
    const content = await Bun.file(gitignoreFile).text()
    if (!content.includes("_tmp_*")) {
      const prefix = content.length === 0 || content.endsWith("\n") ? "" : "\n"
      appendFileSync(gitignoreFile, prefix + gitignoreContent)
      console.log(`✓ Appended to ${gitignoreFile}`)
    } else {
      console.log(`✓ ${gitignoreFile} already configured`)
    }
  } else {
    writeFileSync(gitignoreFile, gitignoreContent)
    console.log(`✓ Created ${gitignoreFile}`)
  }

  ensureTsconfigExclude(tsconfigFile, "_tmp_*")
}

async function clone() {
  await init()
  for (const source of sources) {
    const { repo, branch, subdir, dir } = source
    if (isNonEmptyDir(dir)) {
      console.log(`✓ ${dir} already exists, skipping`)
      continue
    }
    console.log(`↓ Cloning ${repo} (${branch}) to ${dir}...`)
    await gitClone(repo, branch, subdir, dir)
    console.log(`✓ Cloned ${dir}`)
  }
}

async function pull() {
  await init()
  for (const source of sources) {
    const { repo, branch, subdir, dir } = source
    if (!isNonEmptyDir(dir)) {
      console.log(`↓ Cloning ${repo} (${branch}) to ${dir}...`)
      await gitClone(repo, branch, subdir, dir)
      console.log(`✓ Cloned ${dir}`)
      continue
    }
    console.log(`↓ Pulling ${repo} in ${dir}...`)
    await gitPull(dir)
    console.log(`✓ Pulled ${dir}`)
  }
}

const command = process.argv[2]

async function main() {
  switch (command) {
    case "clone":
    case "pull":
      await pull()
      break
    default:
      console.log("Usage: bun scripts/fetch-references.ts [clone|pull]")
      console.log("  clone/pull - Clone missing reference repos and pull existing ones")
      process.exit(1)
  }
}

main().catch(console.error)
