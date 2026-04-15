export async function tracking(ctx: any, next: () => Promise<any>) {
  ctx.status = 200
  ctx.body = { events: [] }
  await next()
}
