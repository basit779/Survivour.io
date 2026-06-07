// Player control: input -> velocity with snappy accel/decel, facing, and timer
// decay (i-frames, hurt flash).
import { approach, clamp } from '../../engine/math'
import { C } from '../../data/balance'
import type { World } from '../World'
import type { InputState } from '../../input/InputState'

export function updatePlayerControl(world: World, input: InputState, dt: number): void {
  const p = world.player
  const targetVx = input.moveX * p.moveSpeed
  const targetVy = input.moveY * p.moveSpeed
  const moving = input.moveMag > 0
  const rate = (moving ? C.PLAYER_ACCEL : C.PLAYER_DECEL) * dt
  p.vx = approach(p.vx, targetVx, rate)
  p.vy = approach(p.vy, targetVy, rate)
  if (moving) {
    p.facingX = input.moveX
    p.facingY = input.moveY
  }
  p.iframe = Math.max(0, p.iframe - dt)
  p.hurtFlash = Math.max(0, p.hurtFlash - dt)
  if (p.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt)
  // position integration + arena clamp
  p.x = clamp(p.x + p.vx * dt, p.radius, C.ARENA_W - p.radius)
  p.y = clamp(p.y + p.vy * dt, p.radius, C.ARENA_H - p.radius)
}
