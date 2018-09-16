import { InputMode, switchInputMode, watchInputMode, registerShortcut } from '../core/input'
import * as inventory from '../core/inventory-layers'
import { h, app } from '../ui/uikit'
import nvim from '../core/neovim'

// TODO: show some layers as disabled? like the langserv layer would be disabled if there
// are not language servers started. user can still see options and info, but visually
// it appears non-functional
//
// can provide in layer description that 'this layer requires language server available'
// the provide current status of lang serv. provide links to where to install langextensions

enum InventoryMode { Main, Layer }

const state = {
  // TODO: don't render this as a normal grid tile. make it separate and
  // style it a bit differently.
  layers: [
    ...inventory.layers,
    {
      kind: 'Search all layer actions',
      keybind: 'SPC',
      description: 'Fuzzy search all layer actions and execute selection',
    },
  ],
  visible: false,
  actions: [] as inventory.InventoryAction[],
}

type S = typeof state

const resetState = { visible: false, actions: [] }

const actions = {
  show: () => ({ visible: true }),
  hide: () => resetState,
  setActions: (actions: inventory.InventoryAction[]) => ({ actions }),
}

type A = typeof actions

const styles = {
  grid: {
    display: 'grid',
    // TODO: make this dynamic to fit as many up to maybe 4 items horizontally
    gridTemplateColumns: '1fr 1fr 1fr',
  }
}

const box = (keybind: string, name: string, desc: string) => h('div', {
  style: {
    display: 'flex',
    flexFlow: 'row',
    background: 'var(--background-b5)',
    borderRadius: '2px',
    margin: '10px',
    width: '320px',
    height: '60px',
  }
}, [
  ,h('div', {
    style: {
      // TODO: try angled side for teh luls
      display: 'flex',
      width: '60px',
      maxWidth: '60px',
      minWidth: '60px',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'var(--background-10)',
      fontSize: '3rem',
      color: 'rgba(255, 255, 255, 0.1)',
      fontWeight: 'bold',
    }
  }, keybind.toUpperCase())

  ,h('div', {
    style: {
      padding: '10px',
      paddingLeft: '13px',
      display: 'flex',
      flexFlow: 'column',
      justifyContent: 'center',
    }
  }, [
    ,h('div', {
      style: {
        fontSize: '1.4rem',
        color: 'var(--foreground)',
      }
    }, name)

    ,h('div', {
      style: {
        color: 'var(--foreground-50)',
      }
    }, desc)
  ])
])

const mainView = ($: S) => h('div', {
  style: styles.grid
}, $.layers.map(m => box(m.keybind, m.kind, m.description)))

const layerView = (actions: inventory.InventoryAction[]) => h('div', {
  style: styles.grid
}, actions.map(m => box(m.keybind, m.name, m.description)))

const view = ($: S) => h('div', {
  style: {
    display: $.visible ? 'flex' : 'none',
    height: '100%',
    // TODO: bundle roboto sans-serif font HWIT IT
    fontFamily: 'sans-serif',
  },
}, [
  ,h('div', {
    style: {
      display: 'flex',
      flex: 1,
      flexFlow: 'column',
      marginBottom: '40px',
    }
  }, [

    // breadcrumbs
    ,h('div', {
      style: {
        display: 'flex',
        flexFlow: 'row',
        background: '#444',
        borderRadius: '5px',
      }
    }, [
      ,h('div', 'Home')
      ,$.actions.length ? h('div', $.actions[0].layer) : undefined
    ])

    ,h('div', {
      style: {
        display: 'flex',
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-end',
      }
    }, [
      ,$.actions.length ? layerView($.actions) : mainView($)
    ])

  ])
])

const ui = app<S, A>({ name: 'inventory', state, view, actions })

// TODO: i think we should figure out a way to map all the registered actions statically
// that way we know all the needed action mappings at veonim startup. right now nvim.registerAction()
// is called dynamically and asynchronously.
//
// we can require modules on demand for onAction param. eg
// { 
//  layer: Language,
//  keybind: 'h',
//  name: 'hover',
//  onAction: require('../src/ai/hover').doHover,
// }
//
// this solves the problem of delayed component loadings. either way after veonim startup
// we will lazyload components, so the 'require' will be cached.
//


// mapping logic:
//
// TODO: disable VK() veonim map all modifiers. its not really useful, clunky, and its
// currently broken anyways
//
// always map shift+ctrl+I to 'inventory'
//
// then:
// determine if it is possible to map inventory to <space> region
//
// is <space> mapped?
// is <space><space> mapped?
//
// if available, continue
//
// go thru all the layer actions and see if they have mappings available
//
// available: -> map inventory to <space> and everything else. no conflicts found
// NOT available: -> go thru registeredActions and find alternative keybinds
//    -> if alternative keybinds CANT be found, fail and dont map to <space>. default s-c-i is still bound
//    -> if alternative keybinds SUCCESS -> map inventory to <space> + substitute keybinds.
//       display in the UI that the regular keybinding was not able to be bound
//       show conflicting keybinding. perhaps the user wants to fix the keybinding
//       back to its desired veonim state. (at least its good to know the keybinding
//       is not standard)
//
// - findAlternativeKeybinding() -> somehow make this deterministic so if we find alternatives
//   those alternatives will be the same on each veonim startup.
//
// btw: if we don't have an action keybinding registered, perhaps we should just forward
// the keybind combo to nvim and have it handle it. its possible that the user has mapped
// some <space>xx combo that we do not have a registered action for


// TODO: how do we map an internal keybinding with the input registry?
setImmediate(async () => {
  const keymap = await nvim.getKeymap()

  const isMapped = {
    space: keymap.has(' '),
    spaceSpace: keymap.has('  '),
    jump: keymap.has(' js'),
  }

  if (!isMapped.space) nvim.cmd('nno <space> :Veonim inventory<cr>')
  if (!isMapped.spaceSpace) nvim.cmd('nno <space><space> :Veonim inventory-search<cr>')

  console.log('isMapped', isMapped)
  console.log('FINAL keymap', keymap)
})

const doInventorySearch = () => {
  console.warn('NYI: inventory search')
  // TODO: ui render fuzzy menu of all layer actions kthx
}

// TODO: how do we support inventory in other modes except normal?
// it shouldn't be that hard to support visual mode, yea?
//
// TODO: i think we should bind this to c-s-p by default. make c-s-p reserved
// for inventory. we try to bind to space if possible, but if user has any
// bindings set to <space> there will always be c-s-p as a fallback.

// TODO: this should be a separate vim command :VeonimInventory
// we should look to see if we need to register any actions that should
// not show up in the UI. perhaps only in the fuzzy search?
const doIntenvory = async () => {
  const timeoutLength = await nvim.options.timeoutlen
  console.log('timeoutLength', timeoutLength)
  ui.show()

  const layerList = Object.values(inventory.layers)
  const validLayerKeybinds = new Set([...layerList.map(m => m.keybind)])

  const reset = (actionFn?: Function) => {
    stopWatchingInput()
    switchInputMode(InputMode.Vim)
    ui.hide()

    // some actions funcs will switch input modes. need to cleanup our shit
    // and only then call the action callback function.
    //
    if (actionFn) setImmediate(actionFn)
  }
  // TODO: maybe not use InputMode.Motion?
  // i think the idea of multiple custom input modes is to allow
  // user to setup custom keybindings per mode (like vim does nativelly)
  // in the inventory we do not want any rebindings. it must be static
  switchInputMode(InputMode.Motion)

  let captureMode = InventoryMode.Main
  let activeLayerActions: inventory.InventoryAction[]

  const stopWatchingInput = watchInputMode(InputMode.Motion, key => {
    if (key === '<Esc>') return reset()

    if (captureMode === InventoryMode.Main && validLayerKeybinds.has(key)) {
      const activeLayer = layerList.find(m => m.keybind === key) as inventory.InventoryLayer
      activeLayerActions = inventory.actions.getActionsForLayer(activeLayer.kind)
      captureMode = InventoryMode.Layer
      ui.setActions(activeLayerActions)
      return
    }

    if (captureMode === InventoryMode.Layer) {
      const action = activeLayerActions!.find(m => m.keybind === key)
      // TODO: what do if we select an invalid key?
      if (!action) return reset()

      return reset(action.onAction)
    }

    // TODO: else what do if we selected an invalid key?
  })
}

nvim.onAction('inventory', doIntenvory)
nvim.onAction('inventory-search', doInventorySearch)

registerShortcut('s-c-i', 'n', doIntenvory)
registerShortcut('s-c-p', 'n', doInventorySearch)
