import { onFnCall, proxyFn, Watchers, ID, CreateTask } from '../support/utils'

type EventFn = { [index: string]: (...args: any[]) => void }
type RequestEventFn = { [index: string]: (...args: any[]) => Promise<any> }

export default (name: string) => {
  const worker = new Worker(`${__dirname}/../workers/${name}.js`)
  const watchers = new Watchers()
  const pendingRequests = new Map()
  const requestId = ID()

  const call: EventFn = onFnCall((event: string, args: any[]) => worker.postMessage([event, args]))
  const on = proxyFn((event: string, cb: (data: any) => void) => watchers.add(event, cb))
  const request: RequestEventFn = onFnCall((event: string, args: any[]) => {
    const task = CreateTask()
    const id = requestId.next()
    pendingRequests.set(id, task.done)
    worker.postMessage([event, args, id])
    return task.promise
  })

  worker.onmessage = ({ data: [e, data = [], id] }: MessageEvent) => {
    if (!id) return watchers.notify(e, ...data)

    if (pendingRequests.has(id)) {
      pendingRequests.get(id)(data)
      pendingRequests.delete(id)
      return
    }

    watchers.notifyFn(e, cb => {
      const resultOrPromise = cb(...data)
      if (!resultOrPromise) return
      if (resultOrPromise.then) resultOrPromise.then((res: any) => worker.postMessage([e, res, id]))
      else worker.postMessage([e, resultOrPromise, id])
    })
  }

  return { on, call, request }
}
