# Global X Freight Hub - next step for exact freight per purchase

This app now exposes a public exact-quote route:

- POST `/_v/quote`

Use it with a cart/orderForm-like payload containing:

- destination postal code
- recipient document when available
- items with dimensions and weight
- total value or item prices

Example URL in workspace:

- `https://freightdev--globalx.myvtex.com/_v/quote`

Important:

- VTEX Shipping Policy still expects shipping strategy and freight templates as the native logistics source.
- VTEX Shipping Network apps officially cover Notification and Tracking, while the checkout SLA is calculated by the fulfillment/logistics layer.
- Because of that, the exact Braspress quote must be wired into checkout by a customization layer or another middleware step that calls this route with real cart data.

What this package already solves:

- exact Braspress quote calculation in backend
- mapping from orderForm-like payloads to Braspress payload
- SLA-like response (`name`, `price`, `shippingEstimate`)
- keeps notification/tracking/health routes working
