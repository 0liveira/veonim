const { src, same } = require('./util')

const defaultConfig = {
  project: {
    root: '~/blarg'
  }
}

const setup = vimConfig => src('config/config-service', {
  'config/default-configs': defaultConfig,
  'core/neovim': {
    default: {
      g: vimConfig,
    },
    '@noCallThru': true,
  }
}).default

describe('config service', () => {
  it('do the needful', done => {
    const cs = setup({ 'vn_project_root': Promise.resolve('shittake') })

    const val = cs('project.root', m => {
      same(m, 'shittake')
      done()
    })

    same(val, '~/blarg')
  })
})
