import https from 'https'
import fs from 'fs'
import path from 'path'

const url = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js'
const outDir = path.join(process.cwd(), 'public', 'assets')
const outFile = path.join(outDir, 'pyodide.js')

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

console.log('Downloading pyodide to', outFile)

const file = fs.createWriteStream(outFile)
https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to download pyodide', res.statusCode)
    process.exit(1)
  }
  res.pipe(file)
  file.on('finish', () => {
    file.close()
    console.log('Downloaded pyodide.js')
  })
}).on('error', (err) => {
  fs.unlinkSync(outFile)
  console.error('Error fetching pyodide:', err.message)
  process.exit(1)
})
