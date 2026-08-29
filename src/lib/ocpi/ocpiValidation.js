export const OCPI_STATUS = {
  SUCCESS: 1000,
  CLIENT_ERROR: 2000,
  SERVER_ERROR: 3000,
}

export const OCPI_ENDPOINTS = {
  CREDENTIALS: 'credentials',
  LOCATIONS: 'locations',
  SESSIONS: 'sessions',
  CDRS: 'cdrs',
  TARIFFS: 'tariffs',
  TOKENS: 'tokens',
  COMMANDS: 'commands',
  CHARGING_PROFILES: 'chargingprofiles',
  HUB_CLIENT_INFO: 'hubclientinfo',
  INVOICE_RECONCILIATION: 'invoicereconciliation',
}

export class OcpiValidationError extends Error {
  constructor(message, field = null) {
    super(message)
    this.name = 'OcpiValidationError'
    this.field = field
  }
}

export function assertObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OcpiValidationError(`${field} must be an object`, field)
  }
}

export function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new OcpiValidationError(`${field} must be a non-empty string`, field)
  }
}

export function assertUrl(value, field) {
  assertNonEmptyString(value, field)
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol')
  } catch {
    throw new OcpiValidationError(`${field} must be an absolute HTTP(S) URL`, field)
  }
}

export function validatePartyId(value, field = 'party_id') {
  assertNonEmptyString(value, field)
  if (!/^[A-Z0-9]{3}$/.test(value)) {
    throw new OcpiValidationError(`${field} must be exactly three uppercase letters or digits`, field)
  }
}

export function validateCountryCode(value, field = 'country_code') {
  assertNonEmptyString(value, field)
  if (!/^[A-Z]{2}$/.test(value)) {
    throw new OcpiValidationError(`${field} must be an uppercase ISO 3166-1 alpha-2 code`, field)
  }
}

export function validateOcpiVersion(value, field = 'version') {
  assertNonEmptyString(value, field)
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(value)) {
    throw new OcpiValidationError(`${field} must be a semantic OCPI version`, field)
  }
}

export function validateVersionList(payload) {
  assertObject(payload, 'versions response')
  if (!Array.isArray(payload.data)) throw new OcpiValidationError('versions response data must be an array', 'data')
  for (const [index, item] of payload.data.entries()) {
    assertObject(item, `data[${index}]`)
    validateOcpiVersion(item.version, `data[${index}].version`)
    assertUrl(item.url, `data[${index}].url`)
  }
  return payload.data
}

export function validateVersionDetails(payload) {
  assertObject(payload, 'version details response')
  assertObject(payload.data, 'data')
  validateOcpiVersion(payload.data.version, 'data.version')
  if (!Array.isArray(payload.data.endpoints)) throw new OcpiValidationError('data.endpoints must be an array', 'data.endpoints')
  for (const [index, endpoint] of payload.data.endpoints.entries()) {
    assertObject(endpoint, `data.endpoints[${index}]`)
    assertNonEmptyString(endpoint.identifier, `data.endpoints[${index}].identifier`)
    assertNonEmptyString(endpoint.role, `data.endpoints[${index}].role`)
    assertUrl(endpoint.url, `data.endpoints[${index}].url`)
  }
  return payload.data
}

export function validateCredentialsPayload(payload) {
  assertObject(payload, 'credentials')
  assertNonEmptyString(payload.token, 'token')
  assertUrl(payload.url, 'url')
  if (!Array.isArray(payload.roles) || payload.roles.length === 0) {
    throw new OcpiValidationError('roles must be a non-empty array', 'roles')
  }
  for (const [index, role] of payload.roles.entries()) {
    assertObject(role, `roles[${index}]`)
    validateCountryCode(role.country_code, `roles[${index}].country_code`)
    validatePartyId(role.party_id, `roles[${index}].party_id`)
    assertNonEmptyString(role.role, `roles[${index}].role`)
  }
  return payload
}

export function ocpiResponse(data, statusCode = OCPI_STATUS.SUCCESS, statusMessage = 'Success') {
  return { status_code: statusCode, status_message: statusMessage, data }
}

export function findEndpoint(versionDetails, identifier) {
  return versionDetails.endpoints.find((endpoint) => endpoint.identifier.toLowerCase() === identifier.toLowerCase())
}
