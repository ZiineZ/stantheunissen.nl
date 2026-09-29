/* Shared GL uniforms. Colours come from CSS custom properties (--gl-*) so the
   stylesheet stays the single source of truth for both themes. */

import * as THREE from 'three'

// Stylized renderer: every colour is authored and output in display (sRGB) space.
THREE.ColorManagement.enabled = false

export const U = {
  uTime: { value: 0 },
  uGround: { value: new THREE.Color() },
  uLine: { value: new THREE.Color() },
  uLineHi: { value: new THREE.Color() },
  uSignal: { value: new THREE.Color() },
  uRingOff: { value: new THREE.Color() },
  uRingOn: { value: new THREE.Color() },
  uRim: { value: new THREE.Color() },
  uSegOff: { value: new THREE.Color() },
  uSegOn: { value: new THREE.Color() },
  uDust: { value: new THREE.Color() },
  /** settled HIGH level on a wire, 0..1 of the signal colour */
  uHigh: { value: 0.55 },
  /** emissive boost for bloom (dark theme) */
  uGlow: { value: 1 },
  uSpec: { value: 0.5 },
}

export function readPalette() {
  const cs = getComputedStyle(document.documentElement)
  const get = (n: string) => cs.getPropertyValue(n).trim() || '#ff00ff'
  U.uGround.value.set(get('--gl-ground'))
  U.uLine.value.set(get('--gl-line'))
  U.uLineHi.value.set(get('--gl-line-hi'))
  U.uSignal.value.set(get('--gl-signal'))
  U.uRingOff.value.set(get('--gl-ring-off'))
  U.uRingOn.value.set(get('--gl-ring-on'))
  U.uRim.value.set(get('--gl-rim'))
  U.uSegOff.value.set(get('--gl-seg-off'))
  U.uSegOn.value.set(get('--gl-seg-on'))
  U.uDust.value.set(get('--gl-dust'))
  const dark = cs.getPropertyValue('--gl-dark').trim() === '1'
  U.uHigh.value = dark ? 0.58 : 0.72
  U.uGlow.value = dark ? 1 : 0
  U.uSpec.value = dark ? 0.55 : 0.18
  return dark
}
