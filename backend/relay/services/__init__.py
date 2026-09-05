"""Institutional vertical-slice services.

The Django ORM is the canonical application persistence layer. PostgreSQL is
expected for production. Existing Supabase Rule 2202 SQL functions are treated
as database calculation primitives and are invoked through the Rule 2202
adapter rather than re-modeling Relay Rider domain entities in Supabase.
"""
