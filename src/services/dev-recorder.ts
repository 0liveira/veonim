import { InventoryLayerKind } from '../core/inventory-layers'
import userSelectOption from '../components/generic-menu'
import { notify, NotifyKind } from '../ui/notifications'
import userPrompt from '../components/generic-prompt'
import * as storage from '../support/local-storage'
import { makel } from '../ui/vanilla'
import nvim from '../core/neovim'

if (process.env.VEONIM_DEV) {
const { default: finder } = require('@medv/finder')

// TODO: stop recording should not be triggered via inventory or vim command
// we should just have a 'STOP' button (easy) or bind a keybind [c-s-s] only
// while there is a dev recording happening (hard)
//
// this way we don't have to do any event cleanup

interface RecordingEvent {
  kind: string
  when: number
  offsetStart: number
  offsetPrevious: number
  selector: string
  event: Event
}

interface Record {
  name: string
  events: RecordingEvent[]
}

const KEY = {
  ALL: 'veonim-dev-recordings',
  ONE: 'veonim-dev-recording-',
  START: 'veonim-dev-recording-startup',
}

const targetEl = document.getElementById('canvas-container') as HTMLElement
const recEl = makel({
  position: 'absolute',
  color: '#fff',
  fontWeight: 'bold',
  right: 0,
  padding: '4px',
  paddingLeft: '8px',
  paddingRight: '8px',
})

const banner = {
  HULK_SMASH: (message: string, color: string) => {
    recEl.innerText = message
    recEl.style.background = color
    targetEl.appendChild(recEl)
  },
  heyBigGuySunsGettingRealLow: () => targetEl.contains(recEl) && targetEl.removeChild(recEl),
}

const monitorEvents = ['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'change', 'focus', 'blur']

let recordedEvents = [] as RecordingEvent[]
let captureEvents = false
let lastRecordedAt = Date.now()
let recordingStartTime = Date.now()

const doRecordStart = () => {
  banner.HULK_SMASH('RECORDING EVENTS', '#7f0202')

  recordedEvents = []
  lastRecordedAt = Date.now()
  recordingStartTime = Date.now()
  captureEvents = true
}

nvim.registerAction({
  layer: InventoryLayerKind.DEV,
  keybind: 's',
  name: 'Start Record',
  description: 'Start dev recorder',
  onAction: doRecordStart,
})

const doRecordStop = async () => {
  banner.heyBigGuySunsGettingRealLow()

  captureEvents = false
  const recordingName = await userPrompt('recording name')

  storage.setItem(`${KEY.ONE}${recordingName}`, {
    name: recordingName,
    events: cleanupRecControlEvents(recordedEvents),
  })

  const recordings = storage.getItem<string[]>(KEY.ALL, [])
  const uniqRecordings = new Set(recordings)
  uniqRecordings.add(recordingName)
  storage.setItem(KEY.ALL, [...uniqRecordings])

  notify(`saved "${recordingName}" to local storage`, NotifyKind.Success)
}

nvim.registerAction({
  layer: InventoryLayerKind.DEV,
  keybind: 't',
  name: 'Stop Record',
  description: 'Stop dev recorder',
  onAction: doRecordStop,
})

const doRecordReplay = async () => {
  const recordingName = await userSelectOption<string>({
    description: 'select recording to replay',
    options: getAllRecordings(),
  })

  const key = recordingName.replace(KEY.ONE, '')
  const { events } = storage.getItem<Record>(recordingName)
  if (!events || !events.length) return notify(`recording "${key}" does not exist`, NotifyKind.Error)

  recordPlayer(events, key)
}

nvim.registerAction({
  layer: InventoryLayerKind.DEV,
  keybind: 'r',
  name: 'Replay Recording',
  description: 'Replay a dev recording',
  onAction: doRecordReplay,
})

const doRecordRemove = async () => {
  const recording = await userSelectOption<string>({
    description: 'select recording to REMOVE',
    options: getAllRecordings(),
  })

  if (!recording) return

  const key = recording.replace(KEY.ONE, '')
  const recordings = storage.getItem<string[]>(KEY.ALL, [])
  const next = recordings.filter(m => m !== key)

  storage.setItem(KEY.ALL, next)
  storage.removeItem(recording)

  notify(`removed "${key}" recording`, NotifyKind.Success)
}

nvim.registerAction({
  layer: InventoryLayerKind.DEV,
  keybind: 'd',
  name: 'Delete Recording',
  description: 'Delete a dev recording',
  onAction: doRecordRemove,
})

const doRecordRemoveAll = async () => {
  const confirmation = await userPrompt('type "yes" to remove all recordings')
  if (confirmation !== 'yes') return notify('did NOT remove all recordings', NotifyKind.Error)

  storage
    .getItem<string[]>(KEY.ALL, [])
    .forEach(rec => storage.removeItem(`${KEY.ONE}${rec}`))

  storage.removeItem(KEY.ALL)

  notify('removed all recordings', NotifyKind.Success)
}

nvim.registerAction({
  layer: InventoryLayerKind.DEV,
  keybind: 'x',
  name: 'Remove ALL Recordings',
  description: 'Remove all dev recordings',
  onAction: doRecordRemoveAll,
})

const doRecordSetStartup = async () => {
  const recordingName = await userSelectOption<string>({
    description: 'select recording for startup',
    options: getAllRecordings(),
  })

  const key = recordingName.replace(KEY.ONE, '')
  const { events } = storage.getItem<Record>(recordingName)
  notify(`set "${key}" as startup replay`, NotifyKind.System)

  storage.setTemp(KEY.START, { events, name: key })
}

nvim.registerAction({
  layer: InventoryLayerKind.DEV,
  keybind: 't',
  name: 'Startup Recording',
  description: 'Set dev recording for app startup',
  onAction: doRecordSetStartup,
})

const createEvent = (kind: string, event: Event) => {
  // InputEvent is still experimental - not widely supported but used in Chrome. No typings in TS lib
  if (kind.includes('input')) return new (window as any).InputEvent(kind, event)
  if (kind.includes('key')) return new KeyboardEvent(kind, event)
  else return new Event(kind, event)
}

const recordPlayer = async (events: RecordingEvent[], key: string) => {
  const replays = events.map(m => ({
    target: document.querySelector(m.selector),
    event: createEvent(m.kind, m.event),
    timeout: m.offsetStart,
  })).filter(m => m.target)

  banner.HULK_SMASH(`${key} REPLAY`, '#3c6d1c')
  const replayFinished = Promise.all(replays.map(m => new Promise(done => setTimeout(() => {
    m.target!.dispatchEvent(m.event)
    done()
  }, m.timeout))))

  await replayFinished
  banner.heyBigGuySunsGettingRealLow()
}

const getAllRecordings = () => storage.getItem(KEY.ALL, []).map((m: string) => ({
  key: `${KEY.ONE}${m}`,
  value: m,
}))

monitorEvents.forEach(ev => window.addEventListener(ev, e => {
  if (!captureEvents) return

  recordedEvents.push({
    kind: e.type,
    when: Date.now(),
    offsetPrevious: Date.now() - lastRecordedAt,
    offsetStart: Date.now() - recordingStartTime,
    selector: finder(e.target as Element),
    event: evvy(e),
  })

  lastRecordedAt = Date.now()
}))

const cleanupRecControlEvents = (recordedEvents: RecordingEvent[]): RecordingEvent[] => {
  if (!recordedEvents.length) return recordedEvents
  const event1 = recordedEvents[0].event as KeyboardEvent
  const events = [...recordedEvents.filter(m => m)]

  if (event1.type === 'keyup' && event1.key === 'r') events.splice(0, 1)

  const eventsToRemove = [
    { key: 's', kind: 'keypress' },
    { key: 's', kind: 'keydown' },
    { key: 'r', kind: 'keypress' },
    { key: 'r', kind: 'keydown' },
    { key: ' ', kind: 'keyup' },
    { key: ' ', kind: 'keypress' },
    { key: ' ', kind: 'keydown' },
  ]

  eventsToRemove.forEach(criteria => {
    const found = findLast(events, ({ event }) => {
      const e = event as KeyboardEvent
      if (!e.key || !e.type) return false
      return e.key === criteria.key && e.type === criteria.kind
    })

    if (found > -1) events.splice(found, 1)
  })

  return events
}

const findLast = <T>(arr: T[], fn: (item: T) => any): number => {
  for (let ix = arr.length - 1; ix > 0; ix--) {
    if (!!fn(arr[ix])) return ix
  }
  return -1
}
  
const props = [
  'altKey', 'bubbles', 'cancelBubble', 'cancelable', 'charCode', 'code',
  'composed', 'ctrlKey', 'data', 'dataTransfer', 'defaultPrevented', 'detail',
  'eventPhase', 'inputType', 'isComposing', 'isTrusted', 'key', 'keyCode',
  'location', 'metaKey', 'repeat', 'returnValue', 'shiftKey', 'type', 'which',
]

const evvy = (eo: any) => props.reduce((res, prop) => Object.assign(res, { [prop]: eo[prop] }), {}) as Event

setTimeout(() => {
  const { events, name } = storage.getTemp<Record>(KEY.START)
  if (events && events.length) recordPlayer(events, name)
}, 250)
} // end of "if" block that only runs stuff in dev mode
