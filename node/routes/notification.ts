import { buildBraspressQuote } from './braspress'

export async function notification(ctx: any, next: () => Promise<any>) {
  const result = await buildBraspressQuote(ctx, ctx.request?.body || {})
  ctx.status = 200
  ctx.body = { slas: result.slas || [] }
  await next()
}
