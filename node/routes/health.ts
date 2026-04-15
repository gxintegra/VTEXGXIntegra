export async function health(ctx: any, next: () => Promise<any>) {
  ctx.status = 200
  ctx.body = { ok: true, service: 'globalx.freight-hub' }
  await next()
}
