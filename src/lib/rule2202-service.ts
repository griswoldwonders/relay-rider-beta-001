// ============================================================================
// Rule 2202 Supabase service — typed queries over the domain model tables
// ============================================================================
// Consumers: PartnerConsoleContext, PartnerConsoleScreen
// Fallback: when supabase client is not configured (no VITE_SUPABASE_* vars),
//           all query functions return null-safe empty results so the UI
//           continues to render from its built-in mock fixtures.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Rule2202Worksite,
  CommuterResearchRecord,
  Rule2202Methodology,
} from '../types';
import {
  worksiteFromRow,
  commuterRecordFromRow,
  methodologyFromRow,
} from './supabase';

// ---- Worksites ----

export interface WorksiteListOptions {
  institutionId?: string;
  limit?: number;
  offset?: number;
}

export async function listWorksites(
  options: WorksiteListOptions = {}
): Promise<Rule2202Worksite[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { institutionId, limit = 100, offset = 0 } = options;

  let query = supabase
    .from('rule2202_worksites')
    .select('*')
    .gte('deleted_at', null as unknown as string)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (institutionId) {
    query = query.eq('institution_id', institutionId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[rule2202-service] listWorksites error:', error);
    return [];
  }

  return (data ?? []).map(worksiteFromRow);
}

export async function getWorksite(
  worksiteId: string
): Promise<Rule2202Worksite | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('rule2202_worksites')
    .select('*')
    .eq('id', worksiteId)
    .eq('deleted_at', null as unknown as string)
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows, not an error
      console.error('[rule2202-service] getWorksite error:', error);
    }
    return null;
  }

  return worksiteFromRow(data);
}

// ---- Commuter research records ----

export interface CommuterRecordListOptions {
  worksiteId: string;
  status?: string;
  limit?: number;
}

export async function listCommuterRecordsForWorksite(
  options: CommuterRecordListOptions
): Promise<CommuterResearchRecord[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { worksiteId, status, limit = 500 } = options;

  let query = supabase
    .from('commuter_research_records')
    .select('*')
    .eq('worksite_id', worksiteId)
    .eq('deleted_at', null as unknown as string)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[rule2202-service] listCommuterRecordsForWorksite error:', error);
    return [];
  }

  return (data ?? []).map(commuterRecordFromRow);
}

// ---- Methodology registry ----

export interface MethodologyListOptions {
  institutionId?: string;
  metricType?: string;
  activeOnly?: boolean;
  limit?: number;
}

export async function listMethodologies(
  options: MethodologyListOptions = {}
): Promise<Rule2202Methodology[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { institutionId, metricType, activeOnly = true, limit = 100 } = options;

  // rule2202_methodologies is institution-scoped: every row has an
  // institution_id and the RLS SELECT policy restricts to the calling user's
  // institution_memberships. Listing "all methodologies" without an
  // institutionId is therefore meaningless at the service layer; require it.
  if (!institutionId) {
    return [];
  }

  let query = supabase
    .from('rule2202_methodologies')
    .select('*')
    .eq('institution_id', institutionId)
    .order('metric_type', { ascending: true })
    .order('factor_year', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (metricType) {
    query = query.eq('metric_type', metricType);
  }

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[rule2202-service] listMethodologies error:', error);
    return [];
  }

  return (data ?? []).map(methodologyFromRow);
}

// ---- Methods whose body is intentionally empty at the JS layer ----

/**
 * Save a worksite update via the Supabase client.
 *
 * NOT IMPLEMENTED in this layer yet. The Partner Console currently renders
 * read-only evidence from the worksite + commuter records it loads. Write path
 * (review state transitions, fee verification, ECRP ETC assignment, filing
 * status changes) should go through a trusted server function or a governed
 * admin UI with audit logging, not a direct client .update() call.
 */
export async function updateWorksite(
  _worksiteId: string,
  _patch: Record<string, unknown>
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  // TODO: implement governed write path with audit logging
  console.warn('[rule2202-service] updateWorksite not implemented — write path should use a Postgres function with audit logging');
  return false;
}

/**
 * Insert a methodology record.
 *
 * NOT IMPLEMENTED in this layer yet. Methodology registry writes should be
 * restricted to admin/reviewer roles and logged.
 */
export async function insertMethodology(
  _methodology: Omit<Rule2202Methodology, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  console.warn('[rule2202-service] insertMethodology not implemented — write path should use a governed admin UI or Postgres function');
  return null;
}
