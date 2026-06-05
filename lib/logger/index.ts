import pino from 'pino'

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: [
    'password',
    'token',
    'authorization',
    'service_role_key',
    'private_key',
    'access_token',
    'refresh_token',
    'google_service_account',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  ],
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
})

export default logger
