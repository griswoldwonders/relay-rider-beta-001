import crypto from 'node:crypto'

function clone(value) {
  return value == null ? value : structuredClone(value)
}

export class InMemoryOcpiCredentialStore {
  #partners = new Map()

  save(partnerId, record) {
    if (!partnerId) throw new Error('partnerId is required')
    const stored = {
      ...clone(record),
      partnerId,
      updatedAt: new Date().toISOString(),
    }
    this.#partners.set(partnerId, stored)
    return this.getPublic(partnerId)
  }

  get(partnerId) {
    const record = this.#partners.get(partnerId)
    return record ? clone(record) : null
  }

  getAuthToken(partnerId) {
    return this.#partners.get(partnerId)?.authToken ?? null
  }

  getPublic(partnerId) {
    const record = this.#partners.get(partnerId)
    if (!record) return null
    const { authToken, ...safe } = clone(record)
    return {
      ...safe,
      authTokenFingerprint: authToken ? crypto.createHash('sha256').update(authToken).digest('hex') : null,
    }
  }

  remove(partnerId) {
    return this.#partners.delete(partnerId)
  }

  listPublic() {
    return [...this.#partners.keys()].map((partnerId) => this.getPublic(partnerId))
  }
}
