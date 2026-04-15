import { buildBraspressQuote } from './braspress'

function setCors(ctx: any) {
  ctx.set('Access-Control-Allow-Origin', '*')
  ctx.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  ctx.set('Access-Control-Allow-Headers', 'Content-Type')
}

async function readRequestBody(ctx: any) {
  const directBody =
    ctx?.request?.body ??
    ctx?.req?.body ??
    ctx?.state?.body

  if (typeof directBody === 'string') {
    try {
      return JSON.parse(directBody)
    } catch {
      return {}
    }
  }

  if (directBody && typeof directBody === 'object' && Object.keys(directBody).length > 0) {
    return directBody
  }

  const req = ctx?.req
  if (!req || typeof req.on !== 'function') {
    return {}
  }

  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: any) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve())
    req.on('error', (error: any) => reject(error))
  })

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function quoteOptions(ctx: any, next: () => Promise<any>) {
  setCors(ctx)
  ctx.status = 204
  await next()
}

export async function quote(ctx: any, next: () => Promise<any>) {
  setCors(ctx)

  const body = await readRequestBody(ctx)

  ctx.vtex.logger.info({
    message: 'quote_request_received',
    bodyKeys: Object.keys(body || {}),
    hasShippingData: !!body?.shippingData,
    hasItems: Array.isArray(body?.items),
    itemsCount: Array.isArray(body?.items) ? body.items.length : 0,
  })

  const result = await buildBraspressQuote(ctx, body)
  ctx.status = 200
  ctx.body = result
  await next()
}