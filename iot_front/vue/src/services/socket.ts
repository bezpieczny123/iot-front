import { SocketError, type Envelope, type Request } from './protocol'

export function connectSocket(receive: (message: Envelope) => void, status: (online: boolean) => void) {
  const url = new URL(import.meta.env.VITE_WS_PATH || '/ws/serverroom', location.origin)
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  }
  const pending = new Map<string, {
    resolve: (response: Envelope) => void
    reject: (error: SocketError) => void
    timer: number
  }>()
  let socket: WebSocket
  let id = 0
  let retry = 1000

  function connect() {
    const current = new WebSocket(url)
    socket = current
    let heartbeat = 0
    current.onopen = () => {
      retry = 1000
      status(true)
      heartbeat = window.setInterval(() => {
        void request({ action: 'PING' }, 'PONG').catch(error => {
          if (error.code === 'TIMEOUT' && current.readyState === WebSocket.OPEN) current.close()
        })
      }, 15000)
    }
    current.onclose = () => {
      window.clearInterval(heartbeat)
      status(false)
      for (const request of pending.values()) {
        window.clearTimeout(request.timer)
        request.reject(new SocketError('DISCONNECTED'))
      }
      pending.clear()
      window.setTimeout(connect, retry)
      retry = Math.min(10000, retry * 2)
    }
    current.onmessage = ({ data }) => {
      if (typeof data !== 'string') return
      let message: Envelope
      try {
        message = JSON.parse(data)
      } catch {
        return
      }
      if (message?.v !== 2 || typeof message.type !== 'string') return
      if (message.request_id === null) {
        receive(message)
        return
      }
      const request = pending.get(message.request_id)
      if (!request) return
      pending.delete(message.request_id)
      window.clearTimeout(request.timer)
      if (message.type === 'ERROR') request.reject(new SocketError(message.code ?? 'UNKNOWN_ERROR'))
      else request.resolve(message)
    }
  }

  connect()
  return request

  function request<T extends Envelope>(body: Request, ...expected: string[]): Promise<T> {
    return new Promise((resolve, reject) => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new SocketError('DISCONNECTED'))
        return
      }
      const request_id = `ui-${++id}`
      const timer = window.setTimeout(() => {
        pending.delete(request_id)
        reject(new SocketError('TIMEOUT'))
      }, 8000)
      pending.set(request_id, {
        resolve: response => {
          if (expected.includes(response.type)) resolve(response as T)
          else reject(new SocketError('INVALID_RESPONSE'))
        },
        reject,
        timer,
      })
      try {
        socket.send(JSON.stringify({ ...body, request_id }))
      } catch {
        window.clearTimeout(timer)
        pending.delete(request_id)
        reject(new SocketError('DISCONNECTED'))
      }
    })
  }
}
