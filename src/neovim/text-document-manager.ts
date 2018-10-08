import { TextDocumentContentChangeEvent } from 'vscode-languageserver-protocol'
import filetypeToLanguageID from '../langserv/vsc-languages'
import { BufferChangeEvent, Buffer } from '../neovim/types'
import { NeovimAPI } from '../neovim/api'
import { EventEmitter } from 'events'

interface Doc {
  uri: string
  name: string
}

interface DocInfo extends Doc {
  languageId: string
  filetype: string
  version: number
}

interface DidOpen extends DocInfo {
  text: string
  textLines: string[]
}

interface DidChange extends DocInfo {
  contentChanges: TextDocumentContentChangeEvent[]
  firstLine: number
  lastLine: number
  textLines: string[]
}

type On<T> = (params: T) => void

const nvimChangeToLSPChange = ({ firstLine, lastLine, lineData }: BufferChangeEvent): TextDocumentContentChangeEvent[] => {
  const isEmpty = !lineData.length
  const range = {
    start: { line: firstLine, character: 0 },
    end: { line: lastLine, character: 0 },
  }

  if (isEmpty) return [{ range, text: '' }]

  const replaceOP = !isEmpty && lastLine - firstLine === 1

  if (replaceOP) return [{
    range,
    text: '',
  }, {
    range: {
      start: { line: firstLine, character: 0 },
      end: { line: firstLine, character: 0 },
    },
    text: lineData.map(line => `${line}\n`).join(''),
  }]

  return [{
    range,
    text: lineData.map(line => `${line}\n`).join(''),
  }]
}

const api = (nvim: NeovimAPI, onlyFiletypeBuffers?: string[]) => {
  const openDocuments = new Set<string>()
  const sentDidOpen = new Set<string>()
  const attachedBuffers = new Set<Buffer>()
  const buffersLastRevisionSent = new Map<string, number>()
  const watchers = new EventEmitter()
  const filetypes = new Set(onlyFiletypeBuffers)
  const invalidFiletype = (ft: string) => filetypes.size && !filetypes.has(ft)
  const dsp = new Set()

  const subscribeToBufferChanges = (buffer: Buffer, name: string) => {
    if (!name || openDocuments.has(name)) return
    openDocuments.add(name)

    const notifyOpen = ({ filetype, lineData, changedTick }: BufferChangeEvent) => {
      sentDidOpen.add(name)
      watchers.emit('didOpen', {
        name,
        filetype,
        version: changedTick,
        uri: `file://${name}`,
        languageId: filetypeToLanguageID(filetype),
        textLines: lineData,
        text: lineData.join('\n'),
      } as DidOpen)
    }

    const notifyChange = (change: BufferChangeEvent) => {
      const { filetype, firstLine, lastLine, lineData: textLines, changedTick: version } = change
      buffersLastRevisionSent.set(name, version)

      watchers.emit('didChange', {
        name,
        version,
        filetype,
        firstLine,
        lastLine,
        textLines,
        uri: `file://${name}`,
        languageId: filetypeToLanguageID(filetype),
        contentChanges: nvimChangeToLSPChange(change),
      } as DidChange)
    }

    buffer.attach({ sendInitialBuffer: true }, changeEvent => {
      // TODO: handle changeEvent.more (partial change event)
      // what do? buffer in memory? can we send partial change events to
      // language servers and extensions?
      if (!sentDidOpen.has(name)) return notifyOpen(changeEvent)
      notifyChange(changeEvent)
    })

    dsp.add(buffer.onChangedTick(revision => {
      buffersLastRevisionSent.set(name, revision)
    }))

    buffer.onDetach(() => {
      openDocuments.delete(name)
      sentDidOpen.delete(name)
      attachedBuffers.delete(buffer)
      watchers.emit('didClose', {
        name,
        uri: `file://${name}`,
      } as Doc)
    })

    attachedBuffers.add(buffer)
  }

  const openBuffer = async (buffer: Buffer) => {
    const filetype = await buffer.getOption('filetype')
    if (invalidFiletype(filetype)) return

    const [ name, revision ] = await Promise.all([
      buffer.name,
      buffer.changedtick,
    ])

    buffersLastRevisionSent.set(name, revision)
    subscribeToBufferChanges(buffer, name)
  }

  dsp.add(nvim.on.bufChange(async buffer => {
    const [ name, revision, filetype ] = await Promise.all([
      buffer.name,
      buffer.changedtick,
      buffer.getOption('filetype'),
    ])

    if (!openDocuments.has(name)) return
    const lastRevisionSent = buffersLastRevisionSent.get(name) || 0
    if (lastRevisionSent >= revision) return

    const fullBufferContents = await buffer.getAllLines()

    watchers.emit('didClose', {
      name,
      uri: `file://${name}`,
    } as Doc)

    watchers.emit('didOpen', {
      name,
      filetype,
      version: revision,
      uri: `file://${name}`,
      languageId: filetypeToLanguageID(filetype),
      textLines: fullBufferContents,
      text: fullBufferContents.join('\n')
    } as DidOpen)
  }))

  dsp.add(nvim.on.bufOpen(openBuffer))

  dsp.add(nvim.on.bufLoad(() => {
    if (invalidFiletype(nvim.state.filetype)) return
    subscribeToBufferChanges(nvim.current.buffer, nvim.state.absoluteFilepath)
  }))

  dsp.add(nvim.on.bufWritePre(() => {
    if (invalidFiletype(nvim.state.filetype)) return
    watchers.emit('willSave', {
      name: nvim.state.absoluteFilepath,
      uri: `file://${nvim.state.absoluteFilepath}`,
    } as Doc)
  }))

  dsp.add(nvim.on.bufWrite(() => {
    if (invalidFiletype(nvim.state.filetype)) return
    watchers.emit('didSave', {
      name: nvim.state.absoluteFilepath,
      uri: `file://${nvim.state.absoluteFilepath}`,
    } as Doc)
  }))

  const on = {
    didOpen: (fn: On<DidOpen>) => watchers.on('didOpen', fn),
    didChange: (fn: On<DidChange>) => watchers.on('didChange', fn),
    willSave: (fn: On<Doc>) => watchers.on('willSave', fn),
    didSave: (fn: On<Doc>) => watchers.on('didSave', fn),
    didClose: (fn: On<Doc>) => watchers.on('didClose', fn),
  }

  const dispose = () => {
    attachedBuffers.forEach(buffer => buffer.detach())
    attachedBuffers.clear()
    watchers.removeAllListeners()
    dsp.forEach(dispose => dispose())
    dsp.clear()
    filetypes.clear()
    openDocuments.clear()
    sentDidOpen.clear()
  }

  return { on, dispose, manualBindBuffer: openBuffer }
}

export default api
export type TextDocumentManager = ReturnType<typeof api>
