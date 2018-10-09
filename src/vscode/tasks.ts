import { Watcher } from '../support/utils'
import * as vsc from 'vscode'

interface Events {
  didStartTask: vsc.TaskStartEvent
  didEndTask: vsc.TaskEndEvent
  didStartTaskProcess: vsc.TaskProcessStartEvent
  didEndTaskProcess: vsc.TaskProcessEndEvent
}

interface MetaTask extends vsc.Task {
  type: string
}

const activeTasks = new Set<vsc.TaskExecution>()
const registeredTasks = new Set<MetaTask>()
const watchers = Watcher<Events>()

const provideTasksAndRegister = async (type: string, provider: vsc.TaskProvider) => {
  const providedTasks = (await provider.provideTasks()) || []
  providedTasks.forEach(task => registeredTasks.add(Object.assign(task, { type })))
}

const tasks: typeof vsc.tasks = {
  get taskExecutions() { return [...activeTasks] },

  onDidStartTask: fn => ({ dispose: watchers.on('didStartTask', fn) }),
  onDidEndTask: fn => ({ dispose: watchers.on('didEndTask', fn) }),
  onDidStartTaskProcess: fn => ({ dispose: watchers.on('didStartTaskProcess', fn) }),
  onDidEndTaskProcess: fn => ({ dispose: watchers.on('didEndTaskProcess', fn) }),

  registerTaskProvider: (type, provider) => {
    provideTasksAndRegister(type, provider)
    // TODO: when do we resolve a task?
    return { dispose: () => console.warn('NYI: remove registered task provider') }
  },

  fetchTasks: async (filter = {}) => {
    const filterQuery = filter.type
    // TODO: get tasks from tasks.json (this will be an async op)
    const tasksFromJson: MetaTask[] = []
    return [...registeredTasks, ...tasksFromJson].filter(mt => mt.type === filterQuery)
  },

  executeTask: async task => {

  },
}

export default tasks
