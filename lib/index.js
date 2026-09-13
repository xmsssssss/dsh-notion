import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'

const NOTION_API_BASE = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'
const MAX_BODY_BYTES = 2 * 1024 * 1024
const SYNC_DEBOUNCE_MS = 1200
const pendingPageSyncs = new Map()

export const name = 'dsh-notion'
export const inject = ['webServer']

function getConfigPath() {
  const dir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'notion')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'config.json')
}

function loadConfig() {
  const p = getConfigPath()
  if (!existsSync(p)) return { apiKey: '', defaultDatabaseId: '', defaultParentPageId: '' }
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return { apiKey: '', defaultDatabaseId: '', defaultParentPageId: '' }
  }
}

function saveConfig(cfg) {
  const p = getConfigPath()
  writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}

function getCacheDir() {
  const dir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'notion', 'cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function normalizeId(value) {
  return String(value || '').trim().replace(/-/g, '')
}

function getPageCachePath(pageId) {
  return join(getCacheDir(), `page_${normalizeId(pageId)}.json`)
}

function loadPageCache(pageId) {
  const path = getPageCachePath(pageId)
  if (!existsSync(path)) return null
  try {
    const cached = JSON.parse(readFileSync(path, 'utf-8'))
    return cached && typeof cached.markdown === 'string' ? cached : null
  } catch {
    return null
  }
}

function savePageCache(pageId, value) {
  const path = getPageCachePath(pageId)
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8')
}

function clearPageCache(pageId) {
  const path = getPageCachePath(pageId)
  if (existsSync(path)) unlinkSync(path)
}

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function errorStatus(error) {
  return Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 500
}

function sendError(res, error) {
  sendJson(res, errorStatus(error), { success: false, error: error.message || String(error) })
}

async function notionFetch(endpoint, method = 'GET', body = null, apiKeyOverride = '') {
  const cfg = loadConfig()
  const apiKey = String(apiKeyOverride || cfg.apiKey || '').trim()
  if (!apiKey) throw new Error('Notion API Key 未配置，请先在连接配置中输入并保存')

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  }
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(`${NOTION_API_BASE}${endpoint}`, opts)
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text || `Notion API 返回了非 JSON 响应 (${res.status})` }
  }
  if (!res.ok) {
    const error = new Error(data.message || `Notion API 错误 (${res.status})`)
    error.status = res.status
    throw error
  }
  return data
}

async function getAllSearchResults(body = {}) {
  const results = []
  let cursor = undefined
  do {
    const page = await notionFetch('/search', 'POST', { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
    results.push(...(page.results || []))
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)
  return results
}

async function queryAllDatabaseRows(databaseId, pageSize = 100) {
  const results = []
  const limit = Math.max(1, Math.min(Number(pageSize) || 100, 100))
  let cursor = undefined
  do {
    const page = await notionFetch(`/databases/${databaseId}/query`, 'POST', { page_size: limit, ...(cursor ? { start_cursor: cursor } : {}) })
    results.push(...(page.results || []))
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)
  return results
}

async function getAllBlockChildren(blockId) {
  const results = []
  let cursor = undefined
  do {
    const query = new URLSearchParams({ page_size: '100' })
    if (cursor) query.set('start_cursor', cursor)
    const page = await notionFetch(`/blocks/${blockId}/children?${query}`)
    results.push(...(page.results || []))
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor)
  return results
}

function splitText(text, limit = 2000) {
  const value = String(text || '')
  const chunks = []
  for (let i = 0; i < value.length; i += limit) chunks.push(value.slice(i, i + limit))
  return chunks.length ? chunks : ['']
}

function richText(content) {
  return splitText(content).map(text => ({ type: 'text', text: { content: text } }))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    let bytes = 0
    let settled = false
    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', chunk => {
      if (settled) return
      bytes += Buffer.byteLength(chunk)
      if (bytes > MAX_BODY_BYTES) {
        fail(httpError(413, '请求体过大'))
        return
      }
      body += chunk
    })
    req.on('end', () => {
      if (settled) return
      try {
        const value = JSON.parse(body || '{}')
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, '请求体必须是 JSON 对象')
        settled = true
        resolve(value)
      } catch (error) {
        fail(error.status ? error : httpError(400, '请求体不是有效 JSON'))
      }
    })
    req.on('error', fail)
  })
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function propertyPayload(value, schema) {
  const type = schema?.type || 'rich_text'
  if (type === 'title' || type === 'rich_text') return { [type]: richText(value) }
  if (type === 'number') {
    if (value === '' || value == null) return { number: null }
    const number = Number(value)
    if (!Number.isFinite(number)) throw httpError(400, `属性“${schema?.name || ''}”不是有效数字`)
    return { number }
  }
  if (type === 'checkbox') {
    if (typeof value === 'boolean') return { checkbox: value }
    if (value === 'true' || value === '1') return { checkbox: true }
    if (value === 'false' || value === '0' || value === '') return { checkbox: false }
    throw httpError(400, `属性“${schema?.name || ''}”不是有效布尔值`)
  }
  if (type === 'url') return { url: value || null }
  if (type === 'email') return { email: value || null }
  if (type === 'date') return { date: value ? { start: String(value) } : null }
  if (type === 'select') return { select: value ? { name: String(value) } : null }
  if (type === 'multi_select') return { multi_select: Array.isArray(value) ? value.map(name => ({ name: String(name) })) : String(value || '').split(',').map(v => v.trim()).filter(Boolean).map(name => ({ name })) }
  throw httpError(400, `暂不支持编辑 ${type} 类型属性`)
}

async function getTitlePropertyName(databaseId) {
  const database = await notionFetch(`/databases/${databaseId}`)
  const entry = Object.entries(database.properties || {}).find(([, property]) => property?.type === 'title')
  if (!entry) throw new Error('Database 未找到标题属性')
  return entry[0]
}

function blockText(block) {
  return block?.[block.type]?.rich_text?.map(item => item.plain_text || item.text?.content || '').join('') || ''
}

function blocksToMarkdown(blocks) {
  return (blocks || []).map(block => {
    const text = blockText(block)
    if (block.type === 'heading_1') return `# ${text}`
    if (block.type === 'heading_2') return `## ${text}`
    if (block.type === 'heading_3') return `### ${text}`
    if (block.type === 'bulleted_list_item') return `- ${text}`
    if (block.type === 'numbered_list_item') return `1. ${text}`
    if (block.type === 'to_do') return `- [${block.to_do?.checked ? 'x' : ' '}] ${text}`
    if (block.type === 'quote') return `> ${text}`
    if (block.type === 'code') return `\`\`\`${block.code?.language === 'plain text' ? '' : block.code?.language || ''}\n${text}\n\`\`\``
    return text
  }).join('\n\n')
}

function markdownToBlocks(markdown) {
  const sections = String(markdown || '').split(/\n\n+/).filter(text => text.trim())
  return sections.map(section => {
    const text = section.trim()
    const code = text.match(/^```([^\n]*)\n([\s\S]*?)\n```$/)
    if (code) {
      const languageAliases = { js: 'javascript', ts: 'typescript', py: 'python', sh: 'shell', bash: 'shell', txt: 'plain text', text: 'plain text' }
      const requested = String(code[1] || '').trim().toLowerCase()
      const language = languageAliases[requested] || requested || 'plain text'
      return { object: 'block', type: 'code', code: { rich_text: richText(code[2]), language } }
    }
    const patterns = [
      [/^###\s+([\s\S]*)$/, 'heading_3'],
      [/^##\s+([\s\S]*)$/, 'heading_2'],
      [/^#\s+([\s\S]*)$/, 'heading_1'],
      [/^>\s+([\s\S]*)$/, 'quote'],
      [/^- \[([ xX])\]\s+([\s\S]*)$/, 'to_do'],
      [/^-\s+([\s\S]*)$/, 'bulleted_list_item'],
      [/^\d+\.\s+([\s\S]*)$/, 'numbered_list_item']
    ]
    for (const [pattern, type] of patterns) {
      const match = text.match(pattern)
      if (!match) continue
      if (type === 'to_do') return { object: 'block', type, to_do: { rich_text: richText(match[2]), checked: match[1].toLowerCase() === 'x' } }
      return { object: 'block', type, [type]: { rich_text: richText(match[1]) } }
    }
    return { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) } }
  })
}

const RETRY_DELAYS_MS = [250, 750, 1500]

async function withRetry(operation) {
  let lastError
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === RETRY_DELAYS_MS.length) break
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    }
  }
  throw lastError
}

function blockPayload(block) {
  const value = block?.[block.type]
  if (!value) throw httpError(400, `不支持的块类型: ${block?.type || 'unknown'}`)
  return { [block.type]: value }
}

async function replacePageContent(pageId, title, markdown) {
  if (title && title.trim()) {
    const page = await withRetry(() => notionFetch(`/pages/${pageId}`))
    const titleName = Object.entries(page.properties || {}).find(([, value]) => value?.type === 'title')?.[0] || 'title'
    await withRetry(() => notionFetch(`/pages/${pageId}`, 'PATCH', { properties: { [titleName]: { title: richText(title.trim()) } } }))
  }

  const existing = await withRetry(() => getAllBlockChildren(pageId))
  const blocks = markdownToBlocks(markdown)
  const shared = Math.min(existing.length, blocks.length)

  // Update compatible blocks in place. This preserves their IDs and avoids a blank page.
  for (let i = 0; i < shared; i++) {
    if (existing[i].type === blocks[i].type) {
      await withRetry(() => notionFetch(`/blocks/${existing[i].id}`, 'PATCH', blockPayload(blocks[i])))
    } else {
      // A type change is staged: create the replacement first, then remove the old block.
      await notionFetch(`/blocks/${pageId}/children`, 'PATCH', { children: [blocks[i]] })
      await withRetry(() => notionFetch(`/blocks/${existing[i].id}`, 'DELETE'))
    }
  }

  // Append new tail blocks before deleting obsolete old tail blocks.
  for (let i = shared; i < blocks.length; i += 100) {
    await notionFetch(`/blocks/${pageId}/children`, 'PATCH', { children: blocks.slice(i, i + 100) })
  }
  for (let i = blocks.length; i < existing.length; i++) {
    await withRetry(() => notionFetch(`/blocks/${existing[i].id}`, 'DELETE'))
  }
}

async function flushPageSync(pageId) {
  const state = pendingPageSyncs.get(pageId)
  if (!state) return
  if (state.running) return state.promise
  state.running = true
  if (state.timer) clearTimeout(state.timer)
  state.timer = null
  state.promise = (async () => {
    try {
      while (state.committedRevision < state.revision) {
        const revision = state.revision
        const title = state.title
        const markdown = state.markdown
        await replacePageContent(pageId, title, markdown)
        state.committedRevision = revision
      }
      if (pendingPageSyncs.get(pageId) === state && state.committedRevision === state.revision) {
        clearPageCache(pageId)
        pendingPageSyncs.delete(pageId)
      }
    } catch (error) {
      savePageCache(pageId, {
        pageId,
        title: state.title,
        markdown: state.markdown,
        revision: state.revision,
        updatedAt: state.updatedAt,
        error: error.message
      })
      throw error
    } finally {
      state.running = false
      state.promise = null
    }
  })()
  return state.promise
}

function schedulePageSync(pageId, title, markdown, cachedRevision = 0) {
  let state = pendingPageSyncs.get(pageId)
  if (!state) {
    state = { pageId, title: '', markdown: '', revision: 0, committedRevision: 0, updatedAt: '', running: false, promise: null, timer: null }
    pendingPageSyncs.set(pageId, state)
  }
  if (state.timer) clearTimeout(state.timer)
  state.revision = Math.max(state.revision + 1, Number(cachedRevision) || 0)
  state.title = title
  state.markdown = markdown
  state.updatedAt = new Date().toISOString()
  state.timer = setTimeout(() => { flushPageSync(pageId).catch(() => {}) }, SYNC_DEBOUNCE_MS)
  savePageCache(pageId, {
    pageId,
    title,
    markdown,
    revision: state.revision,
    updatedAt: state.updatedAt
  })
  return state
}

export function apply(ctx) {
  // 1. 注册 WebServer HTTP 路由
  const routes = [
    {
      method: 'ANY',
      path: '/api/dsh-notion/config',
      async handler(req, res) {
        if (req.method === 'GET') {
          const cfg = loadConfig()
          const masked = cfg.apiKey ? `${cfg.apiKey.slice(0, 7)}...${cfg.apiKey.slice(-4)}` : ''
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
          apiKeyMasked: masked,
          defaultDatabaseId: cfg.defaultDatabaseId || '',
          defaultParentPageId: cfg.defaultParentPageId || '',
          hasKey: Boolean(cfg.apiKey)
        }))
          return
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }
        try {
          const data = await readBody(req)
          const old = loadConfig()
          const apiKey = data.apiKey === undefined ? old.apiKey : String(data.apiKey).trim()
          const updated = {
            apiKey: apiKey || old.apiKey || '',
            defaultDatabaseId: data.defaultDatabaseId === undefined ? old.defaultDatabaseId || '' : String(data.defaultDatabaseId).trim(),
            defaultParentPageId: data.defaultParentPageId === undefined ? old.defaultParentPageId || '' : String(data.defaultParentPageId).trim()
          }
          saveConfig(updated)
          sendJson(res, 200, { success: true })
        } catch (error) {
          sendError(res, error)
        }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/test-connection',
      async handler(req, res) {
        try {
          const body = await readBody(req)
          const user = await notionFetch('/users/me', 'GET', null, body.apiKey)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, user }))
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      }
    },
    {
      method: 'GET',
      path: '/api/dsh-notion/resources',
      async handler(_req, res) {
        try {
          const cfg = loadConfig()
          const rootId = normalizeId(cfg.defaultParentPageId)
          const results = (await getAllSearchResults({
            sort: { direction: 'descending', timestamp: 'last_edited_time' }
          })).filter(item => {
            if (!rootId || normalizeId(item?.id) === rootId) return false
            return item?.parent?.type === 'page_id' && normalizeId(item.parent.page_id) === rootId
          })
          sendJson(res, 200, { object: 'list', results, has_more: false, next_cursor: null })
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/query-database',
      async handler(req, res) {
        try {
          const { databaseId, pageSize = 50 } = await readBody(req)
          const dbId = databaseId || loadConfig().defaultDatabaseId
          if (!dbId) throw httpError(400, '未指定 Database ID 且未配置默认 Database ID')
          const cleanId = normalizeId(dbId)
          const [database, results] = await Promise.all([
            notionFetch(`/databases/${cleanId}`),
            queryAllDatabaseRows(cleanId, pageSize)
          ])
          sendJson(res, 200, { object: 'list', database, results, has_more: false, next_cursor: null })
        } catch (error) {
          sendError(res, error)
        }
      }
    },
    {
      method: 'GET',
      path: '/api/dsh-notion/page-content',
      async handler(req, res) {
        try {
          const url = new URL(req.url, 'http://localhost')
          const pageId = url.searchParams.get('pageId')
          if (!pageId) throw httpError(400, '缺少 pageId 参数')
          const cleanId = normalizeId(pageId)
          const cached = loadPageCache(cleanId)
          if (cached && !pendingPageSyncs.has(cleanId)) {
            schedulePageSync(cleanId, String(cached.title || ''), cached.markdown, cached.revision)
          }
          const [page, blocks] = await Promise.all([
            notionFetch(`/pages/${cleanId}`),
            getAllBlockChildren(cleanId)
          ])
          sendJson(res, 200, {
            page,
            blocks,
            markdown: cached?.markdown ?? blocksToMarkdown(blocks),
            cached: Boolean(cached),
            syncedToNotion: !cached,
            syncError: cached?.error || ''
          })
        } catch (error) {
          sendError(res, error)
        }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/create-page',
      async handler(req, res) {
        try {
            const { title, content, parentId, isDatabase } = await readBody(req)
            if (!String(title || '').trim()) throw httpError(400, '缺少页面标题')
            const cfg = loadConfig()
            const targetParent = parentId || (isDatabase ? cfg.defaultDatabaseId : cfg.defaultParentPageId)
            if (!targetParent) throw new Error('未提供目标 ID 且未配置默认 Parent ID')

            const cleanParent = targetParent.replace(/-/g, '')
            const blocks = markdownToBlocks(content)
            const payload = {
              parent: isDatabase ? { database_id: cleanParent } : { page_id: cleanParent },
              properties: isDatabase ? {
                [await getTitlePropertyName(cleanParent)]: { title: [{ text: { content: title } }] }
              } : {
                title: [{ text: { content: title } }]
              },
              children: blocks.slice(0, 100)
            }

            const created = await notionFetch('/pages', 'POST', payload)
            for (let i = 100; i < blocks.length; i += 100) {
              await notionFetch(`/blocks/${created.id}/children`, 'PATCH', { children: blocks.slice(i, i + 100) })
            }
            sendJson(res, 200, { success: true, page: created })
          } catch (error) {
            sendError(res, error)
          }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/sync-page-markdown',
      async handler(req, res) {
        try {
          const { pageId, title, markdown, immediate } = await readBody(req)
          const cleanId = normalizeId(pageId)
          if (!cleanId) throw httpError(400, '缺少 pageId 参数')
          const state = schedulePageSync(cleanId, String(title || ''), String(markdown || ''))
          if (immediate) {
            if (state.timer) clearTimeout(state.timer)
            state.timer = null
            await flushPageSync(cleanId)
          }
          sendJson(res, 200, { success: true, cached: !immediate, synced: Boolean(immediate) })
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/update-database-row',
      async handler(req, res) {
        try {
          const { rowId, databaseId, properties = {} } = await readBody(req)
          const cleanDb = String(databaseId || '').replace(/-/g, '')
          if (!cleanDb) throw new Error('缺少 databaseId 参数')
          const database = await notionFetch(`/databases/${cleanDb}`)
          const mapped = {}
          for (const [name, value] of Object.entries(properties)) {
            const schema = database.properties?.[name]
            if (schema) mapped[name] = propertyPayload(value, schema)
          }
          if (rowId) {
            const page = await notionFetch(`/pages/${String(rowId).replace(/-/g, '')}`, 'PATCH', { properties: mapped })
            sendJson(res, 200, { success: true, page })
          } else {
            const titleName = Object.entries(database.properties || {}).find(([, value]) => value?.type === 'title')?.[0]
            if (!titleName) throw new Error('Database 未找到标题属性')
            if (!mapped[titleName]) mapped[titleName] = propertyPayload('新记录', database.properties[titleName])
            const page = await notionFetch('/pages', 'POST', { parent: { database_id: cleanDb }, properties: mapped })
            sendJson(res, 200, { success: true, page })
          }
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/add-database-column',
      async handler(req, res) {
        try {
          const { databaseId, name, type = 'rich_text' } = await readBody(req)
          const cleanId = String(databaseId || '').replace(/-/g, '')
          if (!cleanId || !name) throw new Error('缺少 databaseId 或列名称')
          const database = await notionFetch(`/databases/${cleanId}`)
          if (database.properties?.[name]) throw new Error('该列已存在')
          const schema = { [name]: { type } }
          if (type === 'title') schema[name] = { title: {} }
          else schema[name][type] = {}
          const updated = await notionFetch(`/databases/${cleanId}`, 'PATCH', { properties: schema })
          sendJson(res, 200, { success: true, database: updated })
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/create-database',
      async handler(req, res) {
        try {
          const { title, initialColumns = [], parentPageId } = await readBody(req)
          if (!String(title || '').trim()) throw httpError(400, '缺少数据库标题')
          if (!Array.isArray(initialColumns)) throw httpError(400, 'initialColumns 必须是数组')
          const parentId = normalizeId(parentPageId || loadConfig().defaultParentPageId)
          if (!parentId) throw httpError(400, '未配置默认父页面 ID')
          const properties = { 名称: { title: {} } }
          for (const column of initialColumns) {
            if (column?.name && column.name !== '名称') properties[column.name] = { [column.type || 'rich_text']: {} }
          }
          const database = await notionFetch('/databases', 'POST', { parent: { type: 'page_id', page_id: parentId }, title: [{ type: 'text', text: { content: title || '新数据库' } }], properties })
          sendJson(res, 200, { success: true, database })
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/append-block',
      async handler(req, res) {
        try {
          const { pageId, content, type = 'paragraph' } = await readBody(req)
          const cleanId = String(pageId || '').replace(/-/g, '')
          if (!cleanId || !String(content || '').trim()) throw new Error('缺少 pageId 或内容')
          const supported = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'quote', 'bulleted_list_item', 'numbered_list_item', 'to_do']
          const blockType = supported.includes(type) ? type : 'paragraph'
          const value = blockType === 'to_do' ? { rich_text: richText(content), checked: false } : { rich_text: richText(content) }
          const result = await notionFetch(`/blocks/${cleanId}/children`, 'PATCH', { children: [{ object: 'block', type: blockType, [blockType]: value }] })
          sendJson(res, 200, { success: true, result })
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/update-block',
      async handler(req, res) {
        try {
          const { blockId, content, type = 'paragraph' } = await readBody(req)
          const cleanId = String(blockId || '').replace(/-/g, '')
          if (!cleanId) throw new Error('缺少 blockId 参数')
          const supported = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'quote', 'bulleted_list_item', 'numbered_list_item', 'to_do']
          const blockType = supported.includes(type) ? type : 'paragraph'
          const value = blockType === 'to_do' ? { rich_text: richText(content), checked: false } : { rich_text: richText(content) }
          const result = await notionFetch(`/blocks/${cleanId}`, 'PATCH', { [blockType]: value })
          sendJson(res, 200, { success: true, result })
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/delete-block',
      async handler(req, res) {
        try {
          const { blockId } = await readBody(req)
          const cleanId = String(blockId || '').replace(/-/g, '')
          if (!cleanId) throw new Error('缺少 blockId 参数')
          const result = await notionFetch(`/blocks/${cleanId}`, 'DELETE')
          sendJson(res, 200, { success: true, result })
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/update-page-title',
      async handler(req, res) {
        try {
          const { pageId, title } = await readBody(req)
          const cleanId = String(pageId || '').replace(/-/g, '')
          if (!cleanId || !String(title || '').trim()) throw new Error('缺少 pageId 或标题')
          const page = await notionFetch(`/pages/${cleanId}`)
          const titleName = Object.entries(page.properties || {}).find(([, value]) => value?.type === 'title')?.[0] || 'title'
          const result = await notionFetch(`/pages/${cleanId}`, 'PATCH', { properties: { [titleName]: { title: richText(title.trim()) } } })
          sendJson(res, 200, { success: true, page: result })
        } catch (error) { sendError(res, error) }
      }
    },
    {
      method: 'POST',
      path: '/api/dsh-notion/delete-page',
      async handler(req, res) {
        try {
          const { pageId } = await readBody(req)
          const cleanId = normalizeId(pageId)
          if (!cleanId) throw httpError(400, '缺少 pageId 参数')
          if (cleanId === normalizeId(loadConfig().defaultParentPageId)) throw httpError(400, '默认根页面不可删除')
          const result = await notionFetch(`/pages/${cleanId}`, 'PATCH', { archived: true })
          sendJson(res, 200, { success: true, page: result })
        } catch (error) { sendError(res, error) }
      }
    }
  ]

  ctx.effect(() => {
    const disposers = routes.map(route => ctx.webServer.register({
      kind: 'exact',
      path: route.path,
      handler(req, res) {
        if (route.method !== 'ANY' && req.method !== route.method) {
          res.setHeader('Allow', route.method)
          sendJson(res, 405, { error: 'Method Not Allowed' })
          return
        }
        return route.handler(req, res)
      }
    }))
    return () => {
      for (const d of disposers) d()
      for (const state of pendingPageSyncs.values()) {
        if (state.timer) clearTimeout(state.timer)
      }
      pendingPageSyncs.clear()
    }
  }, 'dsh-notion: webserver routes')

  // 2. 注入 Agent 工具
  const tools = ctx.get('tools')
  if (tools && typeof tools.register === 'function') {
    ctx.effect(() => {
      const disposers = []
      disposers.push(tools.register({
      name: 'notion_create_page',
      description: '在已连接的 Notion 中新建页面或知识卡片，用于持久化储存方案、代码或笔记。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '新建页面的标题' },
          content: { type: 'string', description: '页面的正文内容（Markdown 或段落文本）' },
          parentId: { type: 'string', description: '可选的目标父页面 ID 或 Database ID；留空则使用用户配置的默认目标' }
        },
        required: ['title', 'content']
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => value
      },
      async execute({ title, content, parentId }) {
        try {
          const cfg = loadConfig()
          const pid = parentId || cfg.defaultParentPageId
          if (!pid) return '错误：Notion 尚未配置默认父页面，请先在面板中配置。'
          const cleanPid = pid.replace(/-/g, '')
          const blocks = markdownToBlocks(content)
          const payload = {
            parent: { page_id: cleanPid },
            properties: { title: [{ text: { content: title } }] },
            children: blocks.slice(0, 100)
          }
          const res = await notionFetch('/pages', 'POST', payload)
          for (let i = 100; i < blocks.length; i += 100) {
            await notionFetch(`/blocks/${res.id}/children`, 'PATCH', { children: blocks.slice(i, i + 100) })
          }
          return `成功在 Notion 中创建页面！标题: ${title}，ID: ${res.id}，链接: ${res.url}`
        } catch (e) {
          return `创建 Notion 页面失败: ${e.message}`
        }
      }
    }))

    disposers.push(tools.register({
      name: 'notion_add_database_row',
      description: '向 Notion 数据库（Database）添加一条表格记录。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '行记录的标题或 Name' },
          databaseId: { type: 'string', description: '目标数据库 ID，留空使用配置的默认 Database ID' }
        },
        required: ['title']
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => value
      },
      async execute({ title, databaseId }) {
        try {
          const cfg = loadConfig()
          const dbId = databaseId || cfg.defaultDatabaseId
          if (!dbId) return '错误：未指定且未配置默认 Database ID。'
          const cleanId = dbId.replace(/-/g, '')
          const payload = {
            parent: { database_id: cleanId },
            properties: {
              [await getTitlePropertyName(cleanId)]: { title: [{ text: { content: title } }] }
            }
          }
          const res = await notionFetch('/pages', 'POST', payload)
          return `已向 Notion 数据库新增记录！ID: ${res.id}，链接: ${res.url}`
        } catch (e) {
          return `向 Notion 数据库添加记录失败: ${e.message}`
        }
      }
    }))
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'dsh-notion: agent tools')
  }
}
