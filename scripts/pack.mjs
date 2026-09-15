import { build } from "esbuild"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { gzipSync, gunzipSync } from "node:zlib"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"

const manifest = JSON.parse(await readFile("plugin.json", "utf8"))
const pkg = JSON.parse(await readFile("package.json", "utf8"))
assert.equal(manifest.version, pkg.version, "Manifest/package versions must match")
if (process.env.GITHUB_REF_TYPE === "tag") assert.equal(process.env.GITHUB_REF_NAME, `v${manifest.version}`)
const modules = {}
for (const view of manifest.views) {
  const result = await build({
    entryPoints: [view.entry], outfile: "entry.js", bundle: true, write: false,
    format: "esm", platform: "browser", target: "es2022", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true, legalComments: "inline", metafile: true,
    loader: { ".woff2": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{
      name: "maplibre-opaque-frame-worker",
      setup(builder) {
        builder.onLoad({ filter: /maplibre-gl\.mjs$/ }, async ({ path }) => {
          const contents = await readFile(path, "utf8")
          // MapLibre 6 treats opaque-frame Blob URLs as cross-origin and tries
          // to fetch/import them again. Our worker is already a local bundled
          // classic Blob, so create it directly, as MapLibre 5 did.
          const check = "new URL(e,t.href).origin!==t.origin"
          assert.equal(contents.split(check).length, 2, "Review worker adapter when upgrading MapLibre")
          return { contents: contents.replace(check, '!e.startsWith("blob:")&&' + check), loader: "js" }
        })
      },
    }],
  })
  for (const output of Object.values(result.metafile.outputs))
    assert(!output.imports.some(item => item.external && !item.path.startsWith("data:")), "Package must not depend on external code/assets")
  let code = result.outputFiles.find(file => file.path.endsWith(".js"))?.text
  assert(code, "Missing entry module")
  const css = result.outputFiles.find(file => file.path.endsWith(".css"))?.text
  if (css) code = `const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);\n${code}`
  modules[view.entry] = code
}
const envelope = { format: 1, manifest, modules }
const raw = Buffer.from(JSON.stringify(envelope))
assert(raw.length <= 16 * 1024 * 1024, "Package exceeds host limit")
const bytes = gzipSync(raw, { level: 9 })
assert.deepEqual(JSON.parse(gunzipSync(bytes).toString()), envelope)
await mkdir("dist", { recursive: true })
const name = `${manifest.id}-${manifest.version}.eidos-plugin`
await writeFile(`dist/${name}`, bytes)
await writeFile("dist/SHA256SUMS", `${createHash("sha256").update(bytes).digest("hex")}  ${name}\n`)
console.log(`${name}: ${bytes.length} bytes`)
