// Visual QA: load the running dev server in headless Chromium (portrait phone
// viewport), screenshot the menu and a few seconds of live gameplay.
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.URL || 'http://localhost:5173'
const OUT = 'tools/shots'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
page.on('console', (m) => {
  if (m.type() === 'error') console.log('PAGE ERROR:', m.text())
})
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/01-menu.png` })
console.log('menu shot done')

// tap PLAY (center of the play button ~ y 62% of height)
await page.mouse.click(195, 554)
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/02-start.png` })

// let the horde build up, then capture gameplay
await page.waitForTimeout(6000)
await page.screenshot({ path: `${OUT}/03-gameplay.png` })
console.log('gameplay shot done')

// move around a touch to show the survivor + camera
await page.mouse.move(195, 700)
await page.mouse.down()
await page.mouse.move(120, 760, { steps: 10 })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/04-moving.png` })
await page.mouse.up()
console.log('moving shot done')

await browser.close()
console.log('DONE')
