import type { Command, LiveMessage } from '../types'

export function connectSocket(receive: (message: LiveMessage) => void, status: (online: boolean) => void) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = protocol + '//' + location.host + '/ws'
  let socket: WebSocket

  function connect() {
    socket = new WebSocket(url)
    socket.onopen = () => status(true)
    socket.onclose = () => {
      status(false)
      window.setTimeout(connect, 2000)
    }
    socket.onmessage = ({ data }) => {
      let message: unknown
      try {
        message = JSON.parse(data)
      } catch {
        return
      }
      if (!message || typeof message !== 'object') return
      if ('topic' in message && typeof message.topic === 'string' && 'payload' in message) {
        receive({ topic: message.topic, payload: message.payload })
      } else if ('type' in message && message.type === 'event') {
        receive({ type: 'event' })
      } else if ('type' in message && message.type === 'auth' &&
        'username' in message && typeof message.username === 'string') {
        receive({ type: 'auth', username: message.username, level: 'level' in message ? Number(message.level) : 1 })
      }
    }
  }

  connect()
  return (command: Command) => {
    if (socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(command))
    return true
  }
}
