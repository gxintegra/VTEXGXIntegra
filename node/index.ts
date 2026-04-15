import { method, Service } from '@vtex/api'
import { Clients } from './clients'
import { notification } from './routes/notification'
import { tracking } from './routes/tracking'
import { health } from './routes/health'
import { quote, quoteOptions } from './routes/quote'

export default new Service({
  clients: {
    implementation: Clients,
    options: {
      default: {
        retries: 2,
        timeout: 8000,
      },
    },
  },
  routes: {
    notification: method({ POST: [notification] }),
    tracking: method({ POST: [tracking] }),
    quote: method({ OPTIONS: [quoteOptions], POST: [quote] }),
    health: method({ GET: [health] }),
  },
})