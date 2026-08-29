import {
  OCPI_ENDPOINTS,
  OCPI_STATUS,
  assertUrl,
  findEndpoint,
  ocpiResponse,
  validateCredentialsPayload,
  validateVersionDetails,
  validateVersionList,
} from './ocpiValidation.js'

export class OcpiTransportError extends Error {
  constructor(message, { code, cause, url } = {}) {
    super(message, { cause })
    this.name = 'OcpiTransportError'
    this.code = code
    this.url = url
  }
}

export class OcpiProtocolError extends Error {
  constructor(message, { status, statusCode, data, url } = {}) {
    super(message)
    this.name = 'OcpiProtocolError'
    this.status = status
    this.statusCode = statusCode
    this.data = data
    this.url = url
  }
}

export class OcpiClient {
  constructor({ versionsUrl, partnerId, store, fetchImpl = globalThis.fetch, timeoutMs = 15_000, logger = console }) {
    assertUrl(versionsUrl, 'versionsUrl')
    if (!partnerId) throw new Error('partnerId is required')
    if (typeof fetchImpl !== 'function') throw new Error('fetchImpl must be a function')
    this.versionsUrl = versionsUrl.replace(/\/$/, '')
    this.partnerId = partnerId
    this.store = store
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.logger = logger
  }

  async #request(url, { method = 'GET', body, token, signal } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const headers = {
        Accept: 'application/json',
        'User-Agent': 'relay-rider-green-wallet/ocpi',
      }
      if (token) headers.Authorization = `Token ${token}`
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }
      let response
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: signal ?? controller.signal,
        })
      } catch (error) {
        const code = error?.code ?? (error?.name === 'AbortError' ? 'ETIMEDOUT' : 'E_TRANSPORT')
        throw new OcpiTransportError(`OCPI transport failed (${code})`, { code, cause: error, url })
      }
      const text = await response.text()
      let payload
      try {
        payload = text ? JSON.parse(text) : null
      } catch {
        throw new OcpiProtocolError('Provider returned invalid JSON', { status: response.status, url })
      }
      if (!response.ok || !payload || payload.status_code !== OCPI_STATUS.SUCCESS) {
        throw new OcpiProtocolError(payload?.status_message || `Provider request failed with HTTP ${response.status}`, {
          status: response.status,
          statusCode: payload?.status_code,
          data: payload?.data,
          url,
        })
      }
      return payload
    } finally {
      clearTimeout(timer)
    }
  }

  async getVersions() {
    const payload = await this.#request(this.versionsUrl)
    return validateVersionList(payload)
  }

  async getVersionDetails(versionUrl, token = this.store?.getAuthToken(this.partnerId)) {
    assertUrl(versionUrl, 'versionUrl')
    const payload = await this.#request(versionUrl, { token })
    return validateVersionDetails(payload)
  }

  async negotiateVersion({ preferredVersions = ['2.2.1', '2.3.0'] } = {}) {
    const versions = await this.getVersions()
    const selected = preferredVersions.map((version) => versions.find((item) => item.version === version)).find(Boolean)
      ?? versions.at(-1)
    if (!selected) throw new OcpiProtocolError('Provider advertised no usable OCPI versions')
    const details = await this.getVersionDetails(selected.url)
    const credentialsEndpoint = findEndpoint(details, OCPI_ENDPOINTS.CREDENTIALS)
    if (!credentialsEndpoint) throw new OcpiProtocolError('Selected OCPI version does not advertise a credentials endpoint')
    return { version: selected.version, versionUrl: selected.url, details, credentialsEndpoint: credentialsEndpoint.url }
  }

  async exchangeCredentials(credentialsEndpoint, credentials) {
    assertUrl(credentialsEndpoint, 'credentialsEndpoint')
    validateCredentialsPayload(credentials)
    const existingToken = this.store?.getAuthToken(this.partnerId)
    const payload = await this.#request(credentialsEndpoint, {
      method: 'POST',
      body: credentials,
      token: existingToken,
    })
    const received = validateCredentialsPayload(payload.data)
    this.store?.save(this.partnerId, {
      authToken: received.token,
      providerUrl: received.url,
      providerRoles: received.roles,
      credentialsEndpoint,
      connectedAt: new Date().toISOString(),
    })
    return received
  }

  async bootstrap({ credentials, preferredVersions } = {}) {
    const negotiation = await this.negotiateVersion({ preferredVersions })
    if (!credentials) return negotiation
    const providerCredentials = await this.exchangeCredentials(negotiation.credentialsEndpoint, credentials)
    return { ...negotiation, providerCredentials }
  }

  async requestProvider(url, options = {}) {
    const token = options.token ?? this.store?.getAuthToken(this.partnerId)
    return this.#request(url, { ...options, token })
  }
}

export function createOcpiCredentialsRequest({ countryCode, partyId, role, token, url }) {
  return {
    token,
    url,
    roles: [{ country_code: countryCode, party_id: partyId, role }],
  }
}

export function success(data) {
  return ocpiResponse(data)
}
