"""Local no-telemetry configuration for the pinned Blender MCP source install.

Upstream excludes blender_mcp/config.py from Git. Its telemetry module imports
that file even when telemetry is disabled, so provide an inert configuration.
"""
from types import SimpleNamespace
telemetry_config = SimpleNamespace(
    enabled=False,
    max_prompt_length=0,
    supabase_anon_key='',
    supabase_url='',
    supabase_bucket='',
    timeout=1,
)
