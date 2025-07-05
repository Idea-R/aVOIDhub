# MCP Configuration Management

Due to Cursor's 50-tool limit, you need to strategically enable/disable MCP servers based on current tasks.

## Quick Setup

Copy the appropriate configuration to `~/.cursor/mcp.json` and restart Cursor IDE.

## Available Configurations

1. **database-focused.json** - For database/backend work (Filesystem, Git, Supabase)
2. **repo-management.json** - For repository management (Filesystem, Git, GitHub)  
3. **deployment.json** - For deployment tasks (Filesystem, Git, Netlify)
4. **minimal.json** - Just essential tools (Filesystem, Git)

## How to Switch

1. Backup current config: `copy ~/.cursor/mcp.json ~/.cursor/mcp.backup.json`
2. Copy desired config: `copy mcp-configs/[config-name].json ~/.cursor/mcp.json`
3. Restart Cursor IDE
4. Verify green status for enabled MCPs

## Environment Variables Required

All configs use these environment variables (set in your system):
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN` 
- `SUPABASE_ANON_KEY`
- `GITHUB_TOKEN`
- `NETLIFY_ACCESS_TOKEN` 