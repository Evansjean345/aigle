export const HTTP_ERRORS = {
  VALIDATION: {
    status: 422,
    message: 'The country field must be defined',
    details: [{ message: 'The country field must be defined', rule: 'required', field: 'country' }],
  },
  AUTH: {
    status: 401,
    message: 'Authentication failed',
  },
  RATE_LIMIT: {
    status: 429,
    message: 'Too many requests',
  },
  SERVER: {
    status: 500,
    message: 'Internal server error',
  },
  CONFLICT: {
    status: 409,
    message: 'Conflict',
  },
}
