import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const src = path.join(root, 'public', '.htaccess')
const dest = path.join(root, 'dist', '.htaccess')

if (!fs.existsSync(src)) {
  console.error(`Source .htaccess not found at ${src}`)
  process.exit(1)
}

fs.copyFileSync(src, dest)
console.log(`Copied ${src} -> ${dest}`)
