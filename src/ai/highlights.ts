import { highlights, references as getReferences } from '../langserv/adapter'
import { Highlight, HighlightGroupId } from '../neovim/types'
import { InventoryLayerKind } from '../inventory/layers'
import { supports } from '../langserv/server-features'
import { brighten } from '../ui/css'
import nvim from '../core/neovim'

const setHighlightColor = () => {
  const highlightColor = brighten(nvim.state.background, 25)
  nvim.cmd(`highlight ${Highlight.DocumentHighlight} guibg=${highlightColor}`)
}

nvim.watchState.colorscheme(setHighlightColor)
setHighlightColor()

const doHighlight = async () => {
  const referencesSupported = supports.references(nvim.state.cwd, nvim.state.filetype)
  const highlightsSupported = supports.highlights(nvim.state.cwd, nvim.state.filetype)
  const anySupport = highlightsSupported || referencesSupported

  if (!anySupport) return

  const { references } = highlightsSupported
    ? await highlights(nvim.state)
    : await getReferences(nvim.state)

  const buffer = nvim.current.buffer
  buffer.clearHighlight(HighlightGroupId.DocumentHighlight, 0, -1)

  if (!references.length) return

  references.forEach(hi => buffer.addHighlight(
    HighlightGroupId.DocumentHighlight,
    Highlight.DocumentHighlight,
    hi.line,
    hi.column,
    hi.endColumn,
  ))
}

nvim.onAction('highlight', doHighlight)

nvim.registerAction({
  layer: InventoryLayerKind.Language,
  keybind: 'l',
  name: 'Highlight',
  description: 'Highlight symbol',
  onAction: doHighlight,
})

nvim.onAction('highlight-clear', async () => {
  nvim.current.buffer.clearHighlight(HighlightGroupId.DocumentHighlight, 0, -1)
})
