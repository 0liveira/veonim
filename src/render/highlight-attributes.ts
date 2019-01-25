import { asColor, MapMap, MapSet } from '../support/utils'
import { instances } from '../core/instance-manager'
import { pub } from '../messaging/dispatch'
import api from '../core/instance-api'
import { EventEmitter } from 'events'

const ee = new EventEmitter()

export interface Attrs {
  foreground?: number
  background?: number
  special?: number
  reverse?: string
  italic?: string
  bold?: string
  underline?: boolean
  undercurl?: boolean
  cterm_fg?: number
  cterm_bg?: number
}

interface Color {
  foreground?: string
  background?: string
}

interface HighlightGroup {
  foreground?: string
  background?: string
  special?: string
  underline: boolean
  reverse: boolean
}

interface HighlightInfoEvent {
  kind: 'ui' | 'syntax' | 'terminal'
  ui_name: string
  hi_name: string
  id: number
}

interface HighlightInfo {
  kind: 'ui' | 'syntax' | 'terminal'
  name: string
  builtinName: string
  id: number
  hlid: number
}

interface DefaultColors {
  background: string
  foreground: string
  special: string
}

const defaultAppColors = {
  background: '#2d2d2d',
  foreground: '#dddddd',
  special: '#a966ad',
}

const defaultColorsMap = new Map<number, DefaultColors>()
const getCurrentDefaultColors = () => defaultColorsMap.get(instances.current) || defaultAppColors

export const colors: DefaultColors = new Proxy(Object.create(null), {
  get: (_: any, key: string) => Reflect.get(getCurrentDefaultColors(), key),
})

// because we skip allocating 1-char strings in msgpack decode. so if we have a 1-char
// string it might be a code point number - need to turn it back into a string. see
// msgpack-decoder for more info on how this works.
const sillyString = (s: any): string => typeof s === 'number' ? String.fromCodePoint(s) : s

const highlightInfo = MapSet<number, string, HighlightInfo>()
const canvas = document.createElement('canvas')
const ui = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
const highlights = MapMap<number, number, HighlightGroup>()

export const setDefaultColors = (fg: number, bg: number, sp: number) => {
  const defaultColors = defaultColorsMap.get(instances.current) || {} as DefaultColors

  const foreground = fg >= 0 ? asColor(fg) : defaultColors.foreground
  const background = bg >= 0 ? asColor(bg) : defaultColors.background
  const special = sp >= 0 ? asColor(sp) : defaultColors.special

  const same = defaultColors.foreground === foreground
    && defaultColors.background === background
    && defaultColors.special === special

  if (same) return false

  Object.assign(defaultColors, {
    foreground,
    background,
    special: special || defaultAppColors.special,
  })

  defaultColorsMap.set(instances.current, defaultColors)

  pub('colors-changed', {
    fg: defaultColors.foreground,
    bg: defaultColors.background,
  })

  // hlid 0 -> default highlight group
  highlights.set(instances.current, 0, {
    foreground,
    background,
    special,
    underline: false,
    reverse: false,
  })

  return true
}

export const addHighlight = (id: number, attr: Attrs, infos: HighlightInfoEvent[]) => {
  const foreground = attr.reverse
    ? asColor(attr.background)
    : asColor(attr.foreground)

  const background = attr.reverse
    ? asColor(attr.foreground)
    : asColor(attr.background)

  highlights.set(instances.current, id, {
    foreground,
    background,
    special: asColor(attr.special),
    underline: !!(attr.underline || attr.undercurl),
    reverse: !!attr.reverse,
  })

  infos.forEach(info => {
    const name = sillyString(info.hi_name)
    const builtinName = sillyString(info.ui_name)

    highlightInfo.set(instances.current, sillyString(info.hi_name), {
      name,
      builtinName,
      hlid: id,
      id: info.id,
      kind: info.kind,
    })
  })

  ee.emit('highlight-info.added')
}

export const getColorByName = async (name: string): Promise<Color> => {
  const { foreground, background } = await api.nvim.getColorByName(name)
  return {
    foreground: asColor(foreground),
    background: asColor(background),
  }
}

export const getColorById = (id: number): Color => {
  const hlgrp = highlights.get(instances.current, id) || {} as HighlightGroup
  return {
    foreground: hlgrp.foreground,
    background: hlgrp.background,
  }
}

export const highlightLookup = (name: string): HighlightInfo[] => {
  const info = highlightInfo.get(instances.current, name)
  if (!info) return (console.error('highlight info does not exist for:', name), [])
  return [...info]
}
export const getHighlight = (id: number) => highlights.get(instances.current, id)

export const generateColorLookupAtlas = () => {
  // hlid are 0 indexed, but width starts at 1
  const size = highlights.subsize(instances.current)
  canvas.width = size + 1
  canvas.height = 3

  const defaultColors = getCurrentDefaultColors()
  ui.imageSmoothingEnabled = false

  highlights.forEach(instances.current, (hlgrp, id) => {
    const defbg = hlgrp.reverse
      ? defaultColors.foreground
      : defaultColors.background
    ui.fillStyle = hlgrp.background || defbg
    ui.fillRect(id, 0, 1, 1)

    const deffg = hlgrp.reverse
      ? defaultColors.background
      : defaultColors.foreground
    ui.fillStyle = hlgrp.foreground || deffg
    ui.fillRect(id, 1, 1, 1)

    ui.fillStyle = 'pink'
    ui.fillRect(id, 2, 1, 1)
    if (!hlgrp.underline) return

    const color = hlgrp.special || defaultColors.special
    ui.fillStyle = color
    ui.fillRect(id, 2, 1, 1)
  })

  return canvas
}

const blarg = document.createElement('div')
Object.assign(blarg.style, {
  height: '30px',
  zIndex: 9999,
  display: 'flex',
  background: '#000'
})
document.body.appendChild(blarg)

const blarg2 = document.createElement('div')
Object.assign(blarg2.style, {
  height: '30px',
  zIndex: 9999,
  display: 'flex',
  background: '#000'
})
document.body.appendChild(blarg2)

const blarg3 = document.createElement('div')
Object.assign(blarg3.style, {
  height: '30px',
  zIndex: 9999,
  display: 'flex',
  background: '#000'
})
document.body.appendChild(blarg3)

const mk = ([ r, g, b ]) => {

  const { cell } = require('../core/workspace')
    const slice = document.createElement('div')
    Object.assign(slice.style, {
      height: `${cell.height}px`,
      width: `${cell.width}px`,
      background: `rgb(${r}, ${g}, ${b})`,
    })
  return slice
}

window.b = () => {
  for (let ff = 0; ff < 24; ff++) {
    const d = ui.getImageData(ff, 0, 1, 1)
    blarg.appendChild(mk(d.data))

    const d2 = ui.getImageData(ff, 1, 1, 1)
    blarg2.appendChild(mk(d2.data))

    const d3 = ui.getImageData(ff, 2, 1, 1)
    blarg3.appendChild(mk(d3.data))
  }
  window.d()
}

setTimeout(() => {
  window.b()
}, 2e3)

export const getColorAtlas = () => canvas
