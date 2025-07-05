# Simple aVOIDgame Platform Setup Script
Write-Host "Setting up aVOIDgame.io Multi-Game Platform" -ForegroundColor Cyan

# Repository configuration
$repos = @(
    @{ name="hub"; path="aVOIDgame-hub\avoidgame-hub-platform"; url="https://github.com/Idea-R/aVOIDhub.git" },
    @{ name="voidavoid"; path="aVOID"; url="https://github.com/Idea-R/aVOID.git" },
    @{ name="wreckavoid"; path="WreckaVOID"; url="https://github.com/Idea-R/wreckAVOID.git" },
    @{ name="tankavoid"; path="TankaVOID"; url="https://github.com/Idea-R/TankaVOID.git" }
)

# Setup git authentication
Write-Host "Configuring Git..." -ForegroundColor Yellow
git config --global user.name "aVOID Platform Bot"
git config --global user.email "dev@avoidgame.io"

# Process each repository
foreach ($repo in $repos) {
    Write-Host "Setting up $($repo.name)..." -ForegroundColor Magenta
    
    if (Test-Path $repo.path) {
        Set-Location $repo.path
        
        # Initialize git if not already
        if (!(Test-Path ".git")) {
            git init
        }
        
        # Set remote
        try {
            git remote remove origin 2>$null
        } catch {}
        git remote add origin $repo.url
        
        # Create .gitignore
        if (!(Test-Path ".gitignore")) {
            "node_modules/`n*.log`ndist/`nbuild/`n.env*`n.DS_Store" | Out-File -FilePath ".gitignore" -Encoding UTF8
        }
        
        # Create netlify.toml
        if (!(Test-Path "netlify.toml")) {
            $netlifyContent = "[build]`n  publish = `"dist`"`n  command = `"npm run build`"`n`n[[redirects]]`n  from = `"/*`"`n  to = `"/index.html`"`n  status = 200"
            $netlifyContent | Out-File -FilePath "netlify.toml" -Encoding UTF8
        }
        
        # Add and commit
        git add .
        git commit -m "Setup for aVOIDgame.io platform" 2>$null
        
        Write-Host "Repository $($repo.name) configured" -ForegroundColor Green
        Set-Location "C:\dev\aVOID"
    } else {
        Write-Host "Directory $($repo.path) not found" -ForegroundColor Red
    }
}

# Create MCP configuration
Write-Host "Creating MCP configuration..." -ForegroundColor Yellow
$mcpPath = "$env:USERPROFILE\.cursor"
if (!(Test-Path $mcpPath)) {
    New-Item -ItemType Directory -Path $mcpPath -Force | Out-Null
}

$mcpConfig = @{
    mcpServers = @{
        supabase = @{
            command = "npx"
            args = @("-y", "@supabase/mcp")
        }
        github = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-github")
        }
        netlify = @{
            command = "npx"
            args = @("-y", "@netlify/mcp-server")
        }
    }
}

$mcpConfig | ConvertTo-Json -Depth 5 | Out-File -FilePath "$mcpPath\mcp.json" -Encoding UTF8

# Create deployment summary
$summary = "# aVOIDgame.io Platform Setup Complete`n`n"
$summary += "## Repositories Configured:`n"
$summary += "- Hub: https://github.com/Idea-R/aVOIDhub`n"
$summary += "- VOIDaVOID: https://github.com/Idea-R/aVOID`n"
$summary += "- WreckaVOID: https://github.com/Idea-R/wreckAVOID`n"
$summary += "- TankaVOID: https://github.com/Idea-R/TankaVOID`n`n"
$summary += "## Domain Strategy:`n"
$summary += "- aVOIDgame.io (Hub)`n"
$summary += "- aVOIDgame.io/void (VOIDaVOID)`n"
$summary += "- aVOIDgame.io/wreck (WreckaVOID)`n"
$summary += "- aVOIDgame.io/tank (TankaVOID)`n`n"
$summary += "## Next Steps:`n"
$summary += "1. Push repositories to GitHub`n"
$summary += "2. Configure Netlify deployments`n"
$summary += "3. Update MCP credentials`n"
$summary += "4. Set up domain routing`n"

$summary | Out-File -FilePath "SETUP_SUMMARY.md" -Encoding UTF8

Write-Host "Setup complete! Check SETUP_SUMMARY.md for next steps" -ForegroundColor Green 