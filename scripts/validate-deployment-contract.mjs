#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localOnly = process.argv.includes('--local-only');
const deploymentPath = path.join(root, 'DEPLOYMENT.json');
const manifestPath = path.join(root, 'docs', 'CAPABILITY_MANIFEST.json');
const currentStatePath = path.join(root, 'CURRENT_STATE.md');

const fail = message => {
  console.error(`DEPLOYMENT CONTRACT ERROR: ${message}`);
  process.exit(1);
};

for (const required of [deploymentPath, manifestPath, currentStatePath]) {
  if (!existsSync(required)) fail(`${path.relative(root, required)} is missing.`);
}

let deployment;
let manifest;
try {
  deployment = JSON.parse(readFileSync(deploymentPath, 'utf8'));
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`Source-of-truth JSON is invalid: ${error.message}`);
}

if (deployment.schema_version !== 'relay-commuter-deployment-v1') {
  fail(`Unexpected DEPLOYMENT.json schema_version: ${deployment.schema_version}`);
}
if (manifest.schema_version !== 'relay-commuter-capabilities-v1') {
  fail(`Unexpected capability manifest schema_version: ${manifest.schema_version}`);
}

const backend = deployment.institutional_backend_contract ?? {};
if (backend.repository !== 'griswoldwonders/relay-mock-v3') fail('Institutional backend repository is not pinned.');
if (!/^[a-f0-9]{40}$/.test(backend.contract_commit ?? '')) fail('Institutional backend contract commit must be an exact 40-character SHA.');
if (backend.supabase_project_ref !== 'dzrqrqfxcihvufvyctbt') fail('Unexpected Supabase project reference.');

const requiredRpcs = new Set([
  'accept_organization_invitation',
  'get_participant_program_context',
  'submit_participant_commuter_need',
  'submit_participant_planned_route',
  'get_participant_match_previews',
]);
const declaredRpcs = new Set(backend.participant_rpc_contract ?? []);
for (const rpc of requiredRpcs) {
  if (!declaredRpcs.has(rpc)) fail(`Required participant backend RPC is missing from DEPLOYMENT.json: ${rpc}`);
}

const capabilities = new Map((manifest.capabilities ?? []).map(item => [item.id, item]));
for (const id of manifest.required_prototype_only_ids ?? []) {
  const capability = capabilities.get(id);
  if (!capability) fail(`Required prototype-only capability is missing: ${id}`);
  if (capability.code_state !== 'PROTOTYPE_SESSION' || capability.production_state !== 'PROTOTYPE_SESSION') {
    fail(`${id} must remain PROTOTYPE_SESSION in both code_state and production_state until a separately verified backend exists.`);
  }
}

const prototypeOnly = new Set(deployment.prototype_only ?? []);
const deploymentPrototypeMap = {
  template_commuter_matches: 'template_commuter_matches',
  green_route_credits: 'green_route_credit_ledger',
  trip_journey_demo: 'simulated_trip_progression',
  modeled_detour_visuals: 'modeled_detour_visuals',
};
for (const [capabilityId, deploymentId] of Object.entries(deploymentPrototypeMap)) {
  if (!capabilities.has(capabilityId)) fail(`Capability manifest is missing ${capabilityId}.`);
  if (!prototypeOnly.has(deploymentId)) fail(`DEPLOYMENT.json prototype_only is missing ${deploymentId}.`);
}

const mainSha = deployment.client_runtime?.audited_main_sha ?? '';
if (!/^[a-f0-9]{40}$/.test(mainSha)) fail('audited_main_sha must be an exact commit SHA.');

const liveHead = backend.live_migration_head ?? {};
if (!/^\d{14}$/.test(liveHead.version ?? '')) fail('Backend live migration version is missing or malformed.');
if (!/^[a-f0-9]{32}$/.test(liveHead.fingerprint ?? '')) fail('Backend live migration fingerprint is missing or malformed.');

console.log('Static deployment contract validation passed.');

if (localOnly) {
  console.log('Live institutional backend fingerprint check skipped by --local-only.');
  process.exit(0);
}

const restUrl = String(backend.rest_url ?? '').replace(/\/$/, '');
const endpoint = backend.live_head_endpoint;
const publishableKey = backend.publishable_key;
if (!restUrl || !endpoint || !publishableKey) fail('Live backend fingerprint endpoint contract is incomplete.');

let response;
try {
  response = await fetch(`${restUrl}${endpoint}`, {
    headers: { apikey: publishableKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
} catch (error) {
  fail(`Unable to reach live institutional backend fingerprint endpoint: ${error.message}`);
}

if (!response.ok) {
  const body = await response.text();
  fail(`Live backend fingerprint endpoint returned HTTP ${response.status}: ${body.slice(0, 300)}`);
}

let payload;
try {
  payload = await response.json();
} catch (error) {
  fail(`Live backend fingerprint endpoint returned invalid JSON: ${error.message}`);
}

const observed = Array.isArray(payload) ? payload[0] : null;
if (!observed?.migration_version || !observed?.migration_fingerprint) {
  fail('Live backend fingerprint endpoint did not return migration_version and migration_fingerprint.');
}
if (observed.migration_version !== liveHead.version || observed.migration_fingerprint !== liveHead.fingerprint) {
  fail([
    'INSTITUTIONAL BACKEND CONTRACT DRIFT DETECTED.',
    `Expected: ${liveHead.version} / ${liveHead.fingerprint}`,
    `Observed: ${observed.migration_version} / ${observed.migration_fingerprint}`,
    'Review the institutional backend change and deliberately update DEPLOYMENT.json before building/deploying this client.',
  ].join('\n'));
}

console.log(`Live institutional backend fingerprint verified: ${observed.migration_version} / ${observed.migration_fingerprint}`);
