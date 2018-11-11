import * as windows from '../windows/window-manager'
import { partialFill, translate } from '../ui/css'
import { cell } from '../core/canvas-container'

export enum CursorShape {
  block,
  line,
  underline,
}

const position = {
  row: 0,
  col: 0,
}

export const cursor = {
  get row() { return position.row },
  get col() { return position.col },
  color: '#fff',
  type: CursorShape.block,
}

const cursorEl = document.getElementById('cursor') as HTMLElement
const cursorChar = document.createElement('span')
const cursorline = document.getElementById('cursorline') as HTMLElement
export const debugline = document.getElementById('debugline') as HTMLElement
let cursorRequestedToBeHidden = false
let cursorEnabled = true

Object.assign(cursorline.style, {
  background: 'rgba(var(--background-alpha), 0.2)',
  position: 'absolute',
  mixBlendMode: 'screen',
  height: `${cell.height}px`,
  zIndex: 60,
})

Object.assign(debugline.style, {
  display: 'none',
  position: 'absolute',
  mixBlendMode: 'screen',
  height: `${cell.height}px`,
  zIndex: 60,
})

Object.assign(cursorEl.style, {
  zIndex: 70,
  position: 'absolute',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
})

cursorChar.style.filter = 'invert(1) grayscale(1)'
cursorEl.appendChild(cursorChar)

export const getCursorBoundingClientRect = () => cursorline.getBoundingClientRect()

export const setCursorShape = (type: CursorShape, size = 20) => {
  cursor.type = type

  if (type === CursorShape.block) Object.assign(cursorEl.style, {
    background: cursor.color,
    height: `${cell.height}px`,
    width: `${cell.width}px`,
  })

  if (type === CursorShape.line) Object.assign(cursorEl.style, {
    background: cursor.color,
    height: `${cell.height}px`,
    width: `${(cell.width * (size / 100)).toFixed(2)}px`
  })

  if (type === CursorShape.underline) Object.assign(cursorEl.style, {
    background: partialFill('horizontal', cursor.color, size),
    height: `${cell.height}px`,
    width: `${cell.width}px`,
  })
}

export const setCursorColor = (color: string) => {
  cursorChar.style.color = color
  cursor.color = color
  cursorEl.style.background = color
}

export const enableCursor = () => cursorEnabled = true
export const disableCursor = () => cursorEnabled = false

export const hideCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = true
  cursorEl.style.display = 'none'
  cursorline.style.display = 'none'
}

export const showCursor = () => {
  if (!cursorEnabled) return

  cursorRequestedToBeHidden = false
  cursorEl.style.display = 'flex'
  cursorline.style.display = ''
}

export const showCursorline = () => cursorline.style.display = ''

const updateCursorChar = (shape: CursorShape) => {
  if (shape === CursorShape.block) {
    const [ char ] = get(cursor.row, cursor.col)
    cursorChar.innerText = char
    cursorChar.style.display = ''
  }
  else {
    cursorChar.style.display = 'none'
    cursorChar.innerText = ''
  }
}

export const moveCursor = (gridId: number, row: number, col: number) => {
  Object.assign(position, { row, col })

  // even if cursor(line) is hidden, we still need to update the positions.
  // once the cursor elements are re-activated, the position updated while
  // hidden must be accurate. (e.g. using jumpTo() in grep/references/etc)
  const win = windows.get(gridId)
  const cursorPos = win.gridToPixelPosition(row, col)
  const linePos = win.gridToPixelPosition(row, 0)
  const { width } = win.getWindowSize()

  cursorEl.style.transform = translate(cursorPos.x, cursorPos.y)
  cursorline.style.transform = translate(linePos.x, linePos.y)
  cursorline.style.width = `${width}px`

  // updateCursorChar()

  if (cursorRequestedToBeHidden) return
  showCursor()
}

setCursorShape(CursorShape.block)
