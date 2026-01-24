type WorkerTask = 'json' | 'csv'

type WorkerRequest = {
  id: string
  task: WorkerTask
  payload: Record<string, unknown>
}

type WorkerResponse = {
  id: string
  ok: boolean
  result?: string
  error?: string
}

const DEFAULT_TIMEOUT_MS = 15000

const WORKER_SOURCE = [
  'self.onmessage = function(event) {',
  '  var msg = event.data || {};',
  '  var id = msg.id;',
  '  var task = msg.task;',
  '  var payload = msg.payload || {};',
  '  try {',
  '    if (task === "json") {',
  '      var space = payload.pretty ? 2 : 0;',
  '      var json = JSON.stringify(payload.data, null, space);',
  '      self.postMessage({ id: id, ok: true, result: json });',
  '      return;',
  '    }',
  '    if (task === "csv") {',
  '      var data = payload.data;',
  '      if (!Array.isArray(data)) data = [];',
  '      var headers = payload.headers;',
  '      if (!headers || headers.length === 0) {',
  '        headers = data[0] ? Object.keys(data[0]) : [];',
  '      }',
  '      var rows = [];',
  '      rows.push(headers.join(","));',
  '      for (var i = 0; i < data.length; i++) {',
  '        var item = data[i] || {};',
  '        var row = [];',
  '        for (var j = 0; j < headers.length; j++) {',
  '          var header = headers[j];',
  '          var value = item[header];',
  '          if (value === null || value === undefined) {',
  '            row.push("");',
  '            continue;',
  '          }',
  '          if (typeof value === "object") {',
  '            var jsonValue = "";',
  '            try { jsonValue = JSON.stringify(value); } catch (e) { jsonValue = ""; }',
  '            row.push("\\"" + String(jsonValue).replace(/"/g, \'""\') + "\\"");',
  '            continue;',
  '          }',
  '          row.push("\\"" + String(value).replace(/"/g, \'""\') + "\\"");',
  '        }',
  '        rows.push(row.join(","));',
  '      }',
  '      self.postMessage({ id: id, ok: true, result: rows.join("\\n") });',
  '      return;',
  '    }',
  '    self.postMessage({ id: id, ok: false, error: "Unknown task" });',
  '  } catch (error) {',
  '    var message = error && error.message ? error.message : "Worker error";',
  '    self.postMessage({ id: id, ok: false, error: message });',
  '  }',
  '};',
].join('\n')

function supportsWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined'
}

function createWorker(): { worker: Worker; workerUrl: string } {
  const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' })
  const workerUrl = URL.createObjectURL(blob)
  const worker = new Worker(workerUrl)
  return { worker, workerUrl }
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`
    } catch {
      return '""'
    }
  }
  return `"${String(value).replace(/"/g, '""')}"`
}

function buildCsvOnMain(data: Array<Record<string, unknown>>, headers: string[]): string {
  if (headers.length === 0) return ''
  const rows: string[] = []
  rows.push(headers.join(','))
  for (const item of data) {
    const row = headers.map((header) => formatCsvValue(item[header]))
    rows.push(row.join(','))
  }
  return rows.join('\n')
}

async function runWorker(
  task: WorkerTask,
  payload: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  if (!supportsWorker()) {
    throw new Error('Worker not supported')
  }

  const { worker, workerUrl } = createWorker()
  const id = `odcrm_${Date.now()}_${Math.random().toString(16).slice(2)}`

  return new Promise((resolve, reject) => {
    let timeoutId: number | null = null

    const cleanup = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      worker.terminate()
      URL.revokeObjectURL(workerUrl)
    }

    timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Worker timed out'))
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data
      if (!data || data.id !== id) return
      cleanup()
      if (data.ok) {
        resolve(data.result ?? '')
      } else {
        reject(new Error(data.error || 'Worker failed'))
      }
    }

    worker.onerror = () => {
      cleanup()
      reject(new Error('Worker failed'))
    }

    const message: WorkerRequest = { id, task, payload }
    worker.postMessage(message)
  })
}

export async function stringifyForDownload(data: unknown, pretty = true): Promise<string> {
  const fallback = () => JSON.stringify(data, null, pretty ? 2 : 0)
  if (!supportsWorker()) return fallback()

  try {
    return await runWorker('json', { data, pretty })
  } catch (error) {
    if (error instanceof Error && error.message === 'Worker timed out') {
      throw error
    }
    return fallback()
  }
}

export async function buildCsvForDownload(
  data: Array<Record<string, unknown>>,
  headers?: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const safeData = Array.isArray(data) ? data : []
  const safeHeaders =
    headers && headers.length > 0 ? headers : safeData[0] ? Object.keys(safeData[0]) : []
  const fallback = () => buildCsvOnMain(safeData, safeHeaders)
  if (!supportsWorker()) return fallback()

  try {
    return await runWorker('csv', { data: safeData, headers: safeHeaders }, timeoutMs)
  } catch (error) {
    if (error instanceof Error && error.message === 'Worker timed out') {
      throw error
    }
    return fallback()
  }
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
