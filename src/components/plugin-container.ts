import { is } from '../support/utils'
import { cvar } from '../ui/css'
import { h } from '../ui/uikit'

type PluginFnNormal = (visible: boolean, children: any[]) => any
type PluginFnWithStyles = (visible: boolean, styles: object, children: any[]) => any
type PluginFn = PluginFnNormal & PluginFnWithStyles

const base = {
  zIndex: 99,
  display: 'flex',
  width: '100%',
  height: '100%',
  justifyContent: 'center',
}

const normal = { ...base, alignItems: 'flex-start' }
const top = { ...base, alignItems: 'flex-start' }
const bottom = { ...base, alignItems: 'flex-end' }
const right = { ...base, alignItems: 'stretch', justifyContent: 'flex-end' }

const dialog = {
  background: cvar('background-40'),
  marginTop: '15%',
  flexFlow: 'column',
}

export const Plugin = (visible: boolean, children: any[]) => h('div', {
  style: normal,
}, [

  ,h('div', {
    style: {
      ...dialog,
      width: '600px',
      display: visible ? 'flex' : 'none',
    }
  }, children)

])

export const PluginTop: PluginFn = (visible: boolean, ...args: any[]) => h('div', {
  style: top,
}, [

  ,h('div', {
    style: {
      ...dialog,
      width: '400px',
      display: visible ? 'flex' : 'none',
      ...args.find(is.object)
    }
  }, args.find(is.array))

])

export const PluginBottom: PluginFn = (visible: boolean, ...args: any[]) => h('div', {
  style: bottom,
}, [

  ,h('div', {
    style: {
      width: '100%',
      height: '100%',
      flexFlow: 'column',
      background: cvar('background-45'),
      display: visible ? 'flex' : 'none',
      ...args.find(is.object),
    }
  }, args.find(is.array))

])

export const PluginRight = (visible: boolean, children: any[]) => h('div', {
  style: right,
}, [

  ,h('div', {
    style: {
      ...dialog,
      width: '500px',
      height: '100%',
      flexFlow: 'column',
      marginTop: 0,
      display: visible ? 'flex' : 'none',
    }
  }, children)

])
