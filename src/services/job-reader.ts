import { action, systemAction, call, cmd, getCurrent } from '../core/neovim'
import userPicksAnOption, { MenuOption } from '../components/generic-menu'
import { is, debounce, fs } from '../support/utils'
import { BufferVar } from '../core/vim-functions'
import { sessions } from '../core/sessions'
import { addQF } from '../ai/diagnostics'
import * as Icon from 'hyperapp-feather'
import Worker from '../messaging/worker'
import { join } from 'path'

enum ParserFormat {
  Typescript,
  CSharp,
  CPlusPlus,
}

const parserFormatOptions: MenuOption[] = [
  { key: ParserFormat.Typescript, value: 'TypeScript' },
  { key: ParserFormat.CSharp, value: 'C#' },
  { key: ParserFormat.CPlusPlus, value: 'C++' },
]

const formatter = Worker('neovim-error-reader')

const formats = new Map([
  [ParserFormat.Typescript, `%f(%l\\\\\\,%c):\\ %t%*\\\\w\\ TS%n:\\ %m`],
])

const terminals = new Map<number, Map<number, ParserFormat>>()

const registerTerminal = (jobId: number, format: ParserFormat) => {
  const sessionTerminals = terminals.get(sessions.current)
  if (sessionTerminals) return sessionTerminals.set(jobId, format)
  const newSessionTerminals = new Map([ [ jobId, format ] ])
  terminals.set(sessions.current, newSessionTerminals)
}

const unregisterTerminal = (jobId: number) => {
  const sessionTerminals = terminals.get(sessions.current)
  if (sessionTerminals) return sessionTerminals.delete(jobId)
}

const getFormatValue = (format: ParserFormat) =>
  (parserFormatOptions.find(m => m.key === format) || {} as any).value

const getTerminalFormat = (jobId: number) => {
  const sessionTerminals = terminals.get(sessions.current)
  return sessionTerminals ? sessionTerminals.get(jobId) : undefined
}

const bufferings = new Map<number, string[]>()
const buffer = (id: number, stuff: string[]) => bufferings.has(id)
  ? bufferings.get(id)!.push(...stuff)
  : bufferings.set(id, stuff)

let parsingQueue = [] as any[]

const writeData = async (lines: string[]) => {
  const location = join(__dirname, '..', 'errorz')
  await fs.writeFile(location, lines.join('\n'))
  return location
}

const destroyQ = async (format: ParserFormat, id: string) => {
  const filepath = await writeData(parsingQueue)
  parsingQueue = []
  const list = await formatter.request.getErrors(filepath, formats.get(format))
  addQF(list, ParserFormat + id)
}

const tryEmptyQ = debounce(destroyQ, 2e3)
const parseLater = (lines: string[], format: ParserFormat, id: string) => {
  parsingQueue.push(...lines)
  tryEmptyQ(format, id)
}

const parse = (lines: string[], format: ParserFormat, id: string) => {
  parseLater(lines, format, id)

  // TODO: ok now we need to do a few things:
  // - figure out how to group job outputs into logical groupings... timeout based? wait for token
  // like 'build/compile done/success/etc?'
}

systemAction('job-output', (jobId: number, data: string[]) => {
  const lastLine = data[data.length - 1]

  if (lastLine === '') {
    const prevMsg = bufferings.get(jobId) || []
    bufferings.delete(jobId)
    const msg = [...prevMsg, ...data]
    const format = getTerminalFormat(jobId)
    if (is.number(format)) parse(msg, format!, jobId + '')
  }

  else buffer(jobId, data)
})

action('TermAttach', async (providedFormat?: ParserFormat) => {
  const buffer = await getCurrent.buffer
  const jobId = await buffer.getVar('terminal_job_id')
  if (!is.number(jobId)) return

  const format = providedFormat || await userPicksAnOption<ParserFormat>({
    icon: Icon.Mail,
    description: 'choose parser error format',
    options: parserFormatOptions,
  })

  if (!is.number(format)) return

  buffer.setVar(BufferVar.TermAttached, true)
  buffer.setVar(BufferVar.TermFormat, getFormatValue(format))
  cmd(`let g:vn_jobs_connected[${jobId}] = 1`)
  registerTerminal(jobId, format)
})

action('TermDetach', async () => {
  const buffer = await getCurrent.buffer
  const jobId = await buffer.getVar('terminal_job_id')
  if (!is.number(jobId)) return

  buffer.setVar(BufferVar.TermAttached, false)
  buffer.setVar(BufferVar.TermFormat, undefined)
  cmd(`call remove(g:vn_jobs_connected, ${jobId})`)
  unregisterTerminal(jobId)
})

action('TermOpen', (cmd = '/bin/bash') => call.termopen(cmd, {
  on_stdout: 'VeonimTermReader',
  on_exit: 'VeonimTermExit',
}))
