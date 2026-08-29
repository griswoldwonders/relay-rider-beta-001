import {
  OCPI_STATUS,
  assertObject,
  assertUrl,
  ocpiResponse,
  validateCredentialsPayload,
  validateOcpiVersion,
} from './ocpiValidation.js'

function unauthorized(message = 'Invalid OCPI token') {
  return {
    status: 401,
    body: ocpiResponse(null, OCPI_STATUS.CLIENT_ERROR, message),
  }
}

function badRequest(message) {
  return {
    status: 400,
    body: ocpiResponse(null, OCPI_STATUS.CLIENT_ERROR, message),
  }
}

function ok(data) {
  return { status: 200, body: ocpiResponse(data) }
}

function readToken(request) {
  const header = request.headers?.authorization ?? request.headers?.Authorization
  if (!header) return null
  const [scheme, token] = header.trim().split(/\s+/, 2)
  return scheme?.toLowerCase() === 'token' ? token : null
}

export function createOcpiCredentialsHandlers({
  versions,
  versionDetails,
  expectedInboundToken,
  onCredentials,
}) {
  validateOcpiVersion(versions?.[0]?.version, 'versions[0].version')
  assertUrl(versions?.[0]?.url, 'versions[0].url')
  assertObject(versionDetails, 'versionDetails')
  validateOcpiVersion(versionDetails.version, 'versionDetails.version')
  assertUrl(versionDetails.credentialsUrl, 'versionDetails.credentialsUrl')
  if (typeof onCredentials !== 'function') throw new Error('onCredentials must be a function')

  const checkAuth = (request) => {
    if (!expectedInboundToken || readToken(request) !== expectedInboundToken) return unauthorized()
    return null
  }

  return {
    getVersions: async () => ok(versions),

    getVersionDetails: async () => ok({
      version: versionDetails.version,
      endpoints: versionDetails.endpoints,
    }),

    postCredentials: async (request) => {
      const authError = checkAuth(request)
      if (authError) return authError
      try {
        const credentials = validateCredentialsPayload(request.body)
        const result = await onCredentials(credentials, { method: 'POST' })
        return ok(result ?? credentials)
      } catch (error) {
        return badRequest(error.message)
      }
    },

    putCredentials: async (request) => {
      const authError = checkAuth(request)
      if (authError) return authError
      try {
        const credentials = validateCredentialsPayload(request.body)
        const result = await onCredentials(credentials, { method: 'PUT' })
        return ok(result ?? credentials)
      } catch (error) {
        return badRequest(error.message)
      }
    },
  }
}

export function createExpressStyleOcpiRouter(handlers) {
  return {
    async versions(req, res) {
      const result = await handlers.getVersions(req)
      res.status(result.status).json(result.body)
    },
    async versionDetails(req, res) {
      const result = await handlers.getVersionDetails(req)
      res.status(result.status).json(result.body)
    },
    async postCredentials(req, res) {
      const result = await handlers.postCredentials(req)
      res.status(result.status).json(result.body)
    },
    async putCredentials(req, res) {
      const result = await handlers.putCredentials(req)
      res.status(result.status).json(result.body)
    },
  }
}
