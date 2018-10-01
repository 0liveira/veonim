import { rename, textSync } from '../langserv/adapter'
import { supports } from '../langserv/server-features'
import nvim from '../core/neovim'

// TODO: anyway to improve the glitchiness of undo/apply edit? any way to also pause render in undo
// or maybe figure out how to diff based on the partial modification
// call atomic? tricky with getting target lines for replacements
// even if done before atomic operations, line numbers could be off
nvim.onAction('rename', async () => {
  if (!supports.rename(nvim.state.cwd, nvim.state.filetype)) return

  textSync.pause()
  const editPosition = { line: nvim.state.line, column: nvim.state.column }
  nvim.feedkeys('ciw')
  await nvim.untilEvent.insertLeave
  const newName = await nvim.expr('@.')
  nvim.feedkeys('u')
  textSync.resume()

  nvim.applyPatches(await rename({ ...nvim.state, ...editPosition, newName }))
})
