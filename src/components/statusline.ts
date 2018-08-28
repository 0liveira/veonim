import { merge, simplifyPath, absolutePath } from '../support/utils'
import { onStateChange, getColor, current } from '../core/neovim'
import { sub, processAnyBuffered } from '../messaging/dispatch'
import configReader from '../config/config-service'
import { darken, brighten, cvar } from '../ui/css'
import { onSwitchVim } from '../core/sessions'
import { ExtContainer } from '../core/api'
import * as Icon from 'hyperapp-feather'
import { colors } from '../ui/styles'
import { h, app } from '../ui/uikit'
import '../support/git'

interface Tab {
  tab: ExtContainer,
  name: string,
}

interface TabInfo {
  id: number,
  name: string,
}

const state = {
  tabs: [] as TabInfo[],
  active: -1,
  filetype: '',
  runningServers: new Set<string>(),
  mode: 'NORMAL',
  line: 0,
  column: 0,
  cwd: '',
  errors: 0,
  warnings: 0,
  branch: '',
  additions: 0,
  deletions: 0,
  macro: '',
  baseColor: '#6d576a',
}

type S = typeof state

const refreshBaseColor = async () => {
  const { background } = await getColor('StatusLine')
  if (background) ui.setColor(background)
}

const statusGroupStyle = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
}

const itemStyle = {
  color: cvar('foreground-40'),
  display: 'flex',
  height: '100%',
  alignItems: 'center',
  paddingLeft: '20px',
  paddingRight: '20px',
}

const iconBoxStyle = {
  display: 'flex',
  paddingRight: '4px',
  alignItems: 'center',
}

const container = document.getElementById('statusline') as HTMLElement
merge(container.style, {
  height: '24px',
  display: 'flex',
  zIndex: 900,
})

const actions = {
  updateTabs: ({ active, tabs }: any) => ({ active, tabs }),
  setFiletype: (filetype: any) => ({ filetype }),
  setLine: (line: any) => ({ line }),
  setColumn: (column: any) => ({ column }),
  setCwd: ({ cwd, projectRoot }: any) => ({ cwd, projectRoot }),
  setDiagnostics: ({ errors = 0, warnings = 0 }: any) => ({ errors, warnings }),
  setGitBranch: (branch: any) => ({ branch }),
  setGitStatus: ({ additions, deletions }: any) => ({ additions, deletions }),
  setMacro: (macro = '') => ({ macro }),
  setColor: (baseColor: any) => ({ baseColor }),
  aiStart: ({ cwd, filetype }: any) => (s: S) => ({ runningServers: new Set([...s.runningServers, cwd + filetype]) }),
}


const iconStyle = { style: { fontSize: '1.15rem' } }

const view = ($: S) => h('div', {
  style: {
    flex: '1',
    display: 'flex',
    justifyContent: 'space-between',
    background: cvar('background-30'),
    zIndex: '999',
  },
}, [

  // LEFT
  ,h('div', {
    style: statusGroupStyle,
  }, [

    ,h('div', {
      style: {
        ...itemStyle,
        color: brighten($.baseColor, 90),
        background: darken($.baseColor, 20),
        paddingRight: '30px',
        marginRight: '-15px',
        clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 0 100%)',
      },
    }, [
      ,h('div', {
        style: iconBoxStyle,
      }, [
        ,h(Icon.HardDrive, iconStyle)
      ])

      ,h('span', $.cwd || 'no project')
    ])

    // TODO: only show on git projects
    ,h('div', {
      style: {
        ...itemStyle,
        paddingLeft: '30px',
        paddingRight: '30px',
        marginRight: '-15px',
        color: brighten($.baseColor, 40),
        background: darken($.baseColor, 35),
        clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 15px 100%)',
      }
    }, [
      ,h('div', {
        style: {
          ...iconBoxStyle,
          display: $.branch ? '' : 'none',
        },
      }, [
        h(Icon.GitBranch, iconStyle),
      ])

      ,h('span', $.branch || 'git n/a')
    ])

    // TODO: only show on git projects
    ,h('div', {
      style: {
        ...itemStyle,
        paddingLeft: '30px',
        paddingRight: '30px',
        marginRight: '-15px',
        color: brighten($.baseColor, 10),
        background: darken($.baseColor, 50),
        clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 100%, 15px 100%)',
      }
    }, [
      // ADDITIONS
      ,h('div', {
        style: {
          ...iconBoxStyle,
          color: $.additions > 0 ? colors.success : undefined,
        },
      }, [
        ,h(Icon.PlusSquare, iconStyle)
      ])

      ,h('div', {
        style: {
          color: $.additions > 0 ? colors.success : undefined,
        }
      }, `${$.additions}`)

      // DELETIONS
      ,h('div', {
        style: {
          ...iconBoxStyle,
          marginLeft: '12px',
          color: $.deletions > 0 ? colors.error : undefined,
        },
      }, [
        ,h(Icon.MinusSquare, iconStyle)
      ])

      ,h('div', {
        style: {
          color: $.deletions > 0 ? colors.error : undefined,
        },
      }, `${$.deletions}`)
    ])

    ,$.runningServers.has(current.cwd + $.filetype) && h('div', {
      style: itemStyle,
    }, [
      ,h('div', [
        ,h(Icon.Zap, { color: '#555', ...iconStyle })
      ])
    ])

  ])

  // CENTER
  ,h('div', {
    style: statusGroupStyle,
  }, [

    ,$.macro && h('div', {
      style: itemStyle,
    }, [
      ,h('div', {
        style: {
          ...iconBoxStyle,
          color: colors.error,
        }
      }, [
        ,h(Icon.Target, iconStyle)
      ])

      ,h('div', {
        style: {
          color: colors.error,
        }
      }, $.macro)
    ])

  ])

  // RIGHT
  ,h('div', {
    style: statusGroupStyle,
  }, [

    ,h('div', {
      style: {
        ...itemStyle,
        paddingLeft: '30px',
        paddingRight: '30px',
        color: brighten($.baseColor, 10),
        background: darken($.baseColor, 50),
        marginRight: '-15px',
        clipPath: 'polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%)',
      }
    }, [
      // ERRORS
      ,h('div', {
        style: {
          ...iconBoxStyle,
          color: $.errors > 0 ? colors.error : undefined,
        },
      }, [
        ,h(Icon.XCircle, iconStyle)
      ])

      ,h('div', {
        style: {
          color: $.errors > 0 ? colors.error : undefined,
        },
      }, `${$.errors}`)

      // WARNINGS
      ,h('div', {
        style: {
          ...iconBoxStyle,
          marginLeft: '12px',
          color: $.warnings > 0 ? colors.warning : undefined,
        },
      }, [
        ,h(Icon.AlertTriangle, iconStyle)
      ])

      ,h('div', {
        style: {
          color: $.warnings > 0 ? colors.warning : undefined,
        },
      }, `${$.warnings}`)
    ])

    ,h('div', {
      style: {
        ...itemStyle,
        paddingLeft: '30px',
        paddingRight: '20px',
        color: brighten($.baseColor, 60),
        background: darken($.baseColor, 30),
        marginRight: '-20px',
        clipPath: 'polygon(15px 0, 100% 0, 100% 100%, 0 100%)',
      }
    }, [
      ,h('div', `${$.line + 1}:${$.column + 1}`)
    ])

    ,h('div', {
      style: {
        ...itemStyle,
        paddingRight: '0',
        //clipPath: 'polygon(15px 0, 100% 0, 100% 100%, 0 100%)',
      }
    }, [
      ,$.tabs.map(({ id }, ix) => h('div', {
        // TODO: also display name if config declares it to
        key: id,
        style: {
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '8px',
          paddingRight: '8px',
          paddingTop: '4px',
          paddingBottom: '4px',
          color: cvar('foreground-40'),
          ...($.active === id ? {
            background: cvar('background-10'),
            color: cvar('foreground'),
          }: undefined)
        }
      }, ix + 1))
    ])

  ])

])

const ui = app<S, typeof actions>({ name: 'statusline', state, actions, view, element: container })

sub('colorscheme.modified', refreshBaseColor)
onStateChange.colorscheme(refreshBaseColor)
onStateChange.filetype(ui.setFiletype)
onStateChange.line(ui.setLine)
onStateChange.column(ui.setColumn)
onStateChange.cwd((cwd: string) => {
  const defaultRoot = configReader('project.root', (root: string) => {
    ui.setCwd({ cwd: simplifyPath(cwd, absolutePath(root)) })
  })

  defaultRoot && ui.setCwd({ cwd: simplifyPath(cwd, absolutePath(defaultRoot)) })
})

sub('tabs', async ({ curtab, tabs }: { curtab: ExtContainer, tabs: Tab[] }) => {
  const mtabs: TabInfo[] = tabs.map(t => ({ id: t.tab.id, name: t.name }))
  mtabs.length > 1
    ? ui.updateTabs({ active: curtab.id, tabs: mtabs })
    : ui.updateTabs({ active: -1, tabs: [] })
})

sub('git:branch', branch => ui.setGitBranch(branch))
sub('git:status', status => ui.setGitStatus(status))
sub('ai:diagnostics.count', count => ui.setDiagnostics(count))
sub('ai:start', opts => ui.aiStart(opts))
sub('vim:macro.start', reg => ui.setMacro(reg))
sub('vim:macro.end', () => ui.setMacro())
onSwitchVim(() => ui.updateTabs({ active: -1, tabs: [] }))

setImmediate(() => {
  processAnyBuffered('tabs')
  refreshBaseColor()
})
