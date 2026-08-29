import crypto from 'node:crypto'
import {
  OCPI_STATUS,
  OcpiValidationError,
  assertObject,
  assertNonEmptyString,
  ocpiResponse,
  validateCountryCode,
  validatePartyId,
} from './ocpiValidation.js'

const SESSION_STATUSES = new Set(['ACTIVE', 'COMPLETED', 'INVALID', 'PENDING', 'RESERVED'])
const AUTH_METHODS = new Set(['AUTH_REQUEST', 'COMMAND', 'WHITELIST', 'DEBIT'])

function clone(value) {
  return value == null ? value : structuredClone(value)
}

function parseUtcDate(value, field) {
  assertNonEmptyString(value, field)
  const parsed = new Date(value.endsWith('Z') ? value : `${value}Z`)
  if (Number.isNaN(parsed.getTime())) throw new OcpiValidationError(`${field} must be an RFC 3339 UTC timestamp`, field)
  return parsed.toISOString()
}

function assertNumber(value, field, { min = 0 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    throw new OcpiValidationError(`${field} must be a finite number >= ${min}`, field)
  }
}

function validateToken(token, field = 'cdr_token') {
  assertObject(token, field)
  assertNonEmptyString(token.uid, `${field}.uid`)
  assertNonEmptyString(token.type, `${field}.type`)
  assertNonEmptyString(token.contract_id, `${field}.contract_id`)
}

function validateCdrLocation(location, field) {
  assertObject(location, field)
  assertNonEmptyString(location.id, `${field}.id`)
  assertNonEmptyString(location.name, `${field}.name`)
  assertNonEmptyString(location.address, `${field}.address`)
  assertNonEmptyString(location.city, `${field}.city`)
  assertNonEmptyString(location.country, `${field}.country`)
  assertNonEmptyString(location.evse_uid, `${field}.evse_uid`)
  assertNonEmptyString(location.connector_id, `${field}.connector_id`)
}

export function validateSession(session) {
  assertObject(session, 'session')
  validateCountryCode(session.country_code)
  validatePartyId(session.party_id)
  assertNonEmptyString(session.id, 'id')
  if (session.id.length > 36) throw new OcpiValidationError('id must be at most 36 characters for a Session', 'id')
  const startDateTime = parseUtcDate(session.start_date_time, 'start_date_time')
  if (session.end_date_time != null) parseUtcDate(session.end_date_time, 'end_date_time')
  assertNumber(session.kwh, 'kwh')
  assertNonEmptyString(session.currency, 'currency')
  validateToken(session.cdr_token, 'cdr_token')
  assertNonEmptyString(session.auth_method, 'auth_method')
  if (!AUTH_METHODS.has(session.auth_method)) throw new OcpiValidationError(`Unsupported auth_method: ${session.auth_method}`, 'auth_method')
  assertNonEmptyString(session.location_id, 'location_id')
  assertNonEmptyString(session.evse_uid, 'evse_uid')
  assertNonEmptyString(session.connector_id, 'connector_id')
  assertNonEmptyString(session.last_updated, 'last_updated')
  const lastUpdated = parseUtcDate(session.last_updated, 'last_updated')
  assertNonEmptyString(session.status, 'status')
  if (!SESSION_STATUSES.has(session.status)) throw new OcpiValidationError(`Unsupported session status: ${session.status}`, 'status')
  return { ...clone(session), start_date_time: startDateTime, last_updated: lastUpdated }
}

export function validateCdr(cdr) {
  assertObject(cdr, 'cdr')
  validateCountryCode(cdr.country_code)
  validatePartyId(cdr.party_id)
  assertNonEmptyString(cdr.id, 'id')
  if (cdr.id.length > 39) throw new OcpiValidationError('id must be at most 39 characters for a CDR', 'id')
  const startDateTime = parseUtcDate(cdr.start_date_time, 'start_date_time')
  const endDateTime = parseUtcDate(cdr.end_date_time, 'end_date_time')
  if (new Date(endDateTime) < new Date(startDateTime)) throw new OcpiValidationError('end_date_time cannot precede start_date_time', 'end_date_time')
  if (cdr.session_id != null && typeof cdr.session_id !== 'string') throw new OcpiValidationError('session_id must be a string', 'session_id')
  validateToken(cdr.cdr_token)
  assertNonEmptyString(cdr.auth_method, 'auth_method')
  if (!AUTH_METHODS.has(cdr.auth_method)) throw new OcpiValidationError(`Unsupported auth_method: ${cdr.auth_method}`, 'auth_method')
  validateCdrLocation(cdr.cdr_location, 'cdr_location')
  assertNumber(cdr.total_energy, 'total_energy')
  assertNumber(cdr.total_time, 'total_time')
  assertObject(cdr.total_cost, 'total_cost')
  assertNonEmptyString(cdr.total_cost.currency, 'total_cost.currency')
  assertNumber(cdr.total_cost.excl_vat, 'total_cost.excl_vat')
  if (cdr.total_cost.incl_vat != null) assertNumber(cdr.total_cost.incl_vat, 'total_cost.incl_vat')
  if (cdr.credit === true && !cdr.credit_reference_id) {
    throw new OcpiValidationError('credit_reference_id is required for a credit CDR', 'credit_reference_id')
  }
  return { ...clone(cdr), start_date_time: startDateTime, end_date_time: endDateTime }
}

export class InMemorySessionCdrStore {
  #sessions = new Map()
  #cdrs = new Map()
  #events = new Set()
  #tokenLinks = new Map()

  putSession(session) {
    const key = `${session.country_code}:${session.party_id}:${session.id}`
    const current = this.#sessions.get(key)
    if (current && new Date(session.last_updated) < new Date(current.last_updated)) return { record: clone(current), changed: false }
    this.#sessions.set(key, clone(session))
    return { record: clone(session), changed: true }
  }

  patchSession(countryCode, partyId, id, patch) {
    const key = `${countryCode}:${partyId}:${id}`
    const current = this.#sessions.get(key)
    if (!current) return null
    const updated = validateSession({ ...current, ...patch, country_code: countryCode, party_id: partyId, id })
    return this.putSession(updated).record
  }

  getSession(countryCode, partyId, id) {
    return clone(this.#sessions.get(`${countryCode}:${partyId}:${id}`))
  }

  saveCdr(cdr) {
    const key = `${cdr.country_code}:${cdr.party_id}:${cdr.id}`
    if (this.#cdrs.has(key)) return { record: clone(this.#cdrs.get(key)), created: false }
    this.#cdrs.set(key, clone(cdr))
    return { record: clone(cdr), created: true }
  }

  getCdr(countryCode, partyId, id) {
    return clone(this.#cdrs.get(`${countryCode}:${partyId}:${id}`))
  }

  recordEvent(eventId) {
    if (this.#events.has(eventId)) return false
    this.#events.add(eventId)
    return true
  }

  linkToken(tokenUid, link) {
    this.#tokenLinks.set(tokenUid, clone(link))
  }

  findTokenLink(tokenUid) {
    return clone(this.#tokenLinks.get(tokenUid))
  }
}

export class SessionCdrRedemptionService {
  constructor({ store, wallet }) {
    if (!store) throw new Error('store is required')
    if (!wallet || typeof wallet.findByAuthorizationReference !== 'function' || typeof wallet.findByTokenUid !== 'function' || typeof wallet.settleCdr !== 'function') {
      throw new Error('wallet must implement findByAuthorizationReference, findByTokenUid, and settleCdr')
    }
    this.store = store
    this.wallet = wallet
  }

  async ingestSession(session, { eventId = null } = {}) {
    const normalized = validateSession(session)
    if (eventId && !this.store.recordEvent(eventId)) return { duplicate: true, type: 'session', record: this.store.getSession(normalized.country_code, normalized.party_id, normalized.id) }
    const result = this.store.putSession(normalized)
    return { duplicate: false, type: 'session', changed: result.changed, record: result.record }
  }

  async ingestSessionPatch({ countryCode, partyId, id, patch, eventId = null }) {
    validateCountryCode(countryCode)
    validatePartyId(partyId)
    assertNonEmptyString(id, 'id')
    if (eventId && !this.store.recordEvent(eventId)) return { duplicate: true, type: 'session_patch' }
    const record = this.store.patchSession(countryCode, partyId, id, patch)
    if (!record) return { found: false, type: 'session_patch' }
    return { found: true, type: 'session_patch', record }
  }

  async ingestCdr(cdr, { eventId = null } = {}) {
    const normalized = validateCdr(cdr)
    if (eventId && !this.store.recordEvent(eventId)) return { duplicate: true, type: 'cdr', record: this.store.getCdr(normalized.country_code, normalized.party_id, normalized.id) }
    const result = this.store.saveCdr(normalized)
    if (!result.created) return { duplicate: true, type: 'cdr', record: result.record }

    const link = await this.#resolveRedemption(normalized)
    if (!link) {
      return { duplicate: false, type: 'cdr', matched: false, status: 'REVIEW_REQUIRED', record: result.record }
    }

    const settlement = await this.wallet.settleCdr({
      redemptionId: link.redemptionId,
      cdr: normalized,
      session: normalized.session_id ? this.store.getSession(normalized.country_code, normalized.party_id, normalized.session_id) : null,
    })
    return { duplicate: false, type: 'cdr', matched: true, status: settlement.status ?? 'SETTLED', link, settlement, record: result.record }
  }

  async #resolveRedemption(cdr) {
    if (cdr.authorization_reference) {
      const byAuthorization = await this.wallet.findByAuthorizationReference(cdr.authorization_reference)
      if (byAuthorization) return byAuthorization
    }
    const byToken = await this.wallet.findByTokenUid(cdr.cdr_token.uid)
    return byToken || this.store.findTokenLink(cdr.cdr_token.uid)
  }
}

function errorResponse(error) {
  return {
    status: error instanceof OcpiValidationError ? 400 : 500,
    body: ocpiResponse(null, error instanceof OcpiValidationError ? OCPI_STATUS.CLIENT_ERROR : OCPI_STATUS.SERVER_ERROR, error.message),
  }
}

export function createSessionCdrHandlers(service) {
  if (!service) throw new Error('service is required')
  return {
    async putSession(request) {
      try {
        const result = await service.ingestSession(request.body, { eventId: request.headers?.['idempotency-key'] ?? null })
        return { status: 200, body: ocpiResponse(result.record) }
      } catch (error) { return errorResponse(error) }
    },
    async patchSession(request) {
      try {
        const result = await service.ingestSessionPatch({
          countryCode: request.params.countryCode,
          partyId: request.params.partyId,
          id: request.params.id,
          patch: request.body,
          eventId: request.headers?.['idempotency-key'] ?? null,
        })
        if (!result.found) return { status: 404, body: ocpiResponse(null, OCPI_STATUS.CLIENT_ERROR, 'Session not found') }
        return { status: 200, body: ocpiResponse(result.record) }
      } catch (error) { return errorResponse(error) }
    },
    async getSession(request) {
      const record = service.store.getSession(request.params.countryCode, request.params.partyId, request.params.id)
      return record ? { status: 200, body: ocpiResponse(record) } : { status: 404, body: ocpiResponse(null, OCPI_STATUS.CLIENT_ERROR, 'Session not found') }
    },
    async postCdr(request) {
      try {
        const result = await service.ingestCdr(request.body, { eventId: request.headers?.['idempotency-key'] ?? null })
        return { status: result.matched || result.duplicate ? 200 : 202, body: ocpiResponse({ cdr_id: result.record.id, status: result.status, matched: result.matched ?? false }) }
      } catch (error) { return errorResponse(error) }
    },
    async getCdr(request) {
      const record = service.store.getCdr(request.params.countryCode, request.params.partyId, request.params.id)
      return record ? { status: 200, body: ocpiResponse(record) } : { status: 404, body: ocpiResponse(null, OCPI_STATUS.CLIENT_ERROR, 'CDR not found') }
    },
  }
}

export function createExpressStyleSessionCdrRouter(handlers) {
  return {
    async putSession(req, res) { const result = await handlers.putSession({ body: req.body, headers: req.headers, params: req.params }); res.status(result.status).json(result.body) },
    async patchSession(req, res) { const result = await handlers.patchSession({ body: req.body, headers: req.headers, params: req.params }); res.status(result.status).json(result.body) },
    async getSession(req, res) { const result = await handlers.getSession({ headers: req.headers, params: req.params }); res.status(result.status).json(result.body) },
    async postCdr(req, res) { const result = await handlers.postCdr({ body: req.body, headers: req.headers, params: req.params }); res.status(result.status).json(result.body) },
    async getCdr(req, res) { const result = await handlers.getCdr({ headers: req.headers, params: req.params }); res.status(result.status).json(result.body) },
  }
}

export function hashRawPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
