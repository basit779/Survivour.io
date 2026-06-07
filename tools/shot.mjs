// Visual QA: load the dev server in headless Chromium (portrait phone viewport),
// screenshot the menu, an early frame, a kited horde mid-run, and a level-up card.
import { chromium } from 'playwright'
import fs from 'node:fs'

const URL = process.env.URL || 'http://localhost:5173'
const OUT = 'tools/shots'
fs.mkdirSync(OUT, { recursive: true })

const W = 390
const H = 844
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
page.on('console', (m) => {
  if (m.type() === 'error') console.log('PAGE ERROR:', m.text())
})
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const wait = (ms) => page.waitForTimeout(ms)

await page.goto(URL, { waitUntil: 'networkidle' })
await wait(800)
await shot('01-menu')
console.log('menu shot done')

// tap PLAY (center, ~66% height)
await page.mouse.click(W / 2, H * 0.66)
await wait(700)
await shot('02-start')

// Kite: hold pointer down at center (= joystick base), orbit the pointer around it
// so the move direction rotates -> the hero circles, dragging a horde behind it.
// Clear any level-up overlay with keyboard '2' (picks card 2) without releasing.
const cx = W / 2
const cy = H / 2
const R = 150
let gotLevelup = false
await page.mouse.move(cx, cy + R)
await page.mouse.down()
const laps = 3
const stepsPerLap = 48
const total = laps * stepsPerLap
for (let i = 0; i <= total; i++) {
  const a = Math.PI / 2 + (i / stepsPerLap) * Math.PI * 2
  await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
  await wait(60)
  if (i % 12 === 0) await page.keyboard.press('2') // clear level-up if present
  if (i === Math.floor(total * 0.7)) await shot('03-gameplay')
}
console.log('gameplay shot done')
await page.mouse.up()

// grab a level-up card screen: keep killing until one pops, then shoot before picking
await page.mouse.move(cx, cy + R)
await page.mouse.down()
for (let i = 0; i < 80 && !gotLevelup; i++) {
  const a = Math.PI / 2 + (i / 24) * Math.PI * 2
  await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
  await wait(60)
  // detect freeze (level-up) heuristically by sampling every few steps
  if (i % 6 === 0) {
    await page.mouse.up()
    await wait(120)
    const buf = await page.screenshot()
    // if a level-up is up the screen is mostly dark overlay; just capture and break after enough time
    if (i > 18) { await shot('05-levelup'); gotLevelup = true; break }
    await page.mouse.down()
  }
}
await shot('04-moving')
console.log('moving shot done')

await browser.close()
console.log('DONE')
