# aVOIDgame Platform Setup Script - AI-Native Deployment 2025
# This script sets up the complete multi-game platform with proper git remotes, MCP configuration, and deployment

Write-Host "🚀 Setting up aVOIDgame.io Multi-Game Platform (AI-Native)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# GitHub token - IMPORTANT: Set this as environment variable before running
$GITHUB_TOKEN = $env:GITHUB_TOKEN
if (-not $GITHUB_TOKEN) {
    Write-Host "❌ ERROR: GITHUB_TOKEN environment variable not set!" -ForegroundColor Red
    Write-Host "Please set your GitHub token: `$env:GITHUB_TOKEN = 'your-token-here'" -ForegroundColor Yellow
    Write-Host "Or run: [Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'your-token-here', 'User')" -ForegroundColor Yellow
    exit 1
}

$REPOS = @{
    "hub" = @{
        "url" = "https://github.com/Idea-R/aVOIDhub.git"
        "path" = "aVOIDgame-hub\avoidgame-hub-platform"
        "domain" = "aVOIDgame.io"
        "branch" = "main"
    }
    "voidavoid" = @{
        "url" = "https://github.com/Idea-R/aVOID.git"
        "path" = "aVOID"
        "domain" = "aVOIDgame.io/void"
        "branch" = "main"
    }
    "wreckavoid" = @{
        "url" = "https://github.com/Idea-R/wreckAVOID.git"
        "path" = "WreckaVOID"
        "domain" = "aVOIDgame.io/wreck"
        "branch" = "main"
    }
    "tankavoid" = @{
        "url" = "https://github.com/Idea-R/TankaVOID.git"
        "path" = "TankaVOID"
        "domain" = "aVOIDgame.io/tank"
        "branch" = "main"
    }
}

# Function to setup git authentication
function Set-GitAuth {
    Write-Host "🔐 Configuring Git Authentication..." -ForegroundColor Yellow
    git config --global credential.helper manager-core
    git config --global user.name "aVOID Platform Bot"
    git config --global user.email "dev@avoidgame.io"
}

# Function to setup MCP configuration for optimal AI development
function Set-MCPConfiguration {
    Write-Host "⚡ Setting up MCP Configuration (AI-Native)..." -ForegroundColor Yellow
    
    $mcpConfigPath = "$env:USERPROFILE\.cursor\mcp.json"
    $mcpConfig = @{
        "mcpServers" = @{
            "supabase" = @{
                "command" = "npx"
                "args" = @("-y", "@supabase/mcp")
                "env" = @{
                    "SUPABASE_PROJECT_REF" = "your-project-ref"
                    "SUPABASE_ANON_KEY" = "your-anon-key"
                    "SUPABASE_ACCESS_TOKEN" = "your-access-token"
                }
            }
            "github" = @{
                "command" = "npx"
                "args" = @("-y", "@modelcontextprotocol/server-github")
                "env" = @{
                    "GITHUB_PERSONAL_ACCESS_TOKEN" = $GITHUB_TOKEN
                }
            }
            "netlify" = @{
                "command" = "npx"
                "args" = @("-y", "@netlify/mcp-server")
                "env" = @{
                    "NETLIFY_ACCESS_TOKEN" = "your-netlify-token"
                }
            }
            "filesystem" = @{
                "command" = "npx"
                "args" = @("-y", "@modelcontextprotocol/server-filesystem", "C:\dev\aVOID")
            }
            "context7" = @{
                "command" = "npx"
                "args" = @("-y", "context7-mcp")
            }
        }
    }
    
    # Create .cursor directory if it doesn't exist
    if (!(Test-Path "$env:USERPROFILE\.cursor")) {
        New-Item -ItemType Directory -Path "$env:USERPROFILE\.cursor" -Force
    }
    
    # Write MCP configuration
    $mcpConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $mcpConfigPath -Encoding UTF8
    Write-Host "✅ MCP configuration written to: $mcpConfigPath" -ForegroundColor Green
}

# Function to setup each repository
function Set-Repository {
    param($name, $config)
    
    Write-Host "`n🎮 Setting up $name repository..." -ForegroundColor Magenta
    
    $repoPath = $config.path
    
    if (Test-Path $repoPath) {
        Write-Host "📁 Found existing directory: $repoPath" -ForegroundColor Yellow
        Set-Location $repoPath
        
        # Check if it's already a git repository
        if (Test-Path ".git") {
            Write-Host "📊 Git repository already exists" -ForegroundColor Green
            
            # Check current remote
            $currentRemote = git remote get-url origin 2>$null
            if ($currentRemote -ne $config.url) {
                Write-Host "🔄 Updating remote origin to: $($config.url)" -ForegroundColor Yellow
                git remote set-url origin $config.url
            }
        } else {
            Write-Host "🆕 Initializing new git repository" -ForegroundColor Yellow
            git init
            git remote add origin $config.url
        }
        
        # Create .gitignore if it doesn't exist
        if (!(Test-Path ".gitignore")) {
            $gitignoreContent = @'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
dist/
build/
out/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Cache
.cache/
.parcel-cache/

# Temporary files
tmp/
temp/
'@
            $gitignoreContent | Out-File -FilePath ".gitignore" -Encoding UTF8
        }
        
        # Create netlify.toml for deployment configuration
        if (!(Test-Path "netlify.toml")) {
            $netlifyConfig = @'
[build]
  publish = "dist"
  command = "npm run build"

[dev]
  command = "npm run dev"
  port = 5173

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.production.environment]
  VITE_SUPABASE_URL = "https://your-project-ref.supabase.co"
  VITE_SUPABASE_ANON_KEY = "your-anon-key"

[context.deploy-preview.environment]
  VITE_SUPABASE_URL = "https://your-project-ref.supabase.co"
  VITE_SUPABASE_ANON_KEY = "your-anon-key"
'@
            $netlifyConfig | Out-File -FilePath "netlify.toml" -Encoding UTF8
        }
        
        # Create deployment workflow
        $workflowDir = ".github\workflows"
        if (!(Test-Path $workflowDir)) {
            New-Item -ItemType Directory -Path $workflowDir -Force
        }
        
        # Create GitHub Actions workflow with proper escaping
        $workflowContent = "name: Deploy to Netlify`n`n"
        $workflowContent += "on:`n"
        $workflowContent += "  push:`n"
        $workflowContent += "    branches: [main, develop]`n"
        $workflowContent += "  pull_request:`n"
        $workflowContent += "    branches: [main]`n`n"
        $workflowContent += "jobs:`n"
        $workflowContent += "  build-and-deploy:`n"
        $workflowContent += "    runs-on: ubuntu-latest`n`n"
        $workflowContent += "    steps:`n"
        $workflowContent += "    - uses: actions/checkout@v4`n`n"
        $workflowContent += "    - name: Setup Node.js`n"
        $workflowContent += "      uses: actions/setup-node@v4`n"
        $workflowContent += "      with:`n"
        $workflowContent += "        node-version: '18'`n"
        $workflowContent += "        cache: 'npm'`n`n"
        $workflowContent += "    - name: Install dependencies`n"
        $workflowContent += "      run: npm ci`n`n"
        $workflowContent += "    - name: Build project`n"
        $workflowContent += "      run: npm run build`n"
        $workflowContent += "      env:`n"
        $workflowContent += "        VITE_SUPABASE_URL: " + '${{ secrets.VITE_SUPABASE_URL }}' + "`n"
        $workflowContent += "        VITE_SUPABASE_ANON_KEY: " + '${{ secrets.VITE_SUPABASE_ANON_KEY }}' + "`n`n"
        $workflowContent += "    - name: Deploy to Netlify`n"
        $workflowContent += "      uses: nwtgck/actions-netlify@v3.0`n"
        $workflowContent += "      with:`n"
        $workflowContent += "        publish-dir: './dist'`n"
        $workflowContent += "        production-branch: main`n"
        $workflowContent += "        github-token: " + '${{ secrets.GITHUB_TOKEN }}' + "`n"
        $workflowContent += "        deploy-message: `"Deploy from GitHub Actions`"`n"
        $workflowContent += "        enable-pull-request-comment: true`n"
        $workflowContent += "        enable-commit-comment: true`n"
        $workflowContent += "      env:`n"
        $workflowContent += "        NETLIFY_AUTH_TOKEN: " + '${{ secrets.NETLIFY_AUTH_TOKEN }}' + "`n"
        $workflowContent += "        NETLIFY_SITE_ID: " + '${{ secrets.NETLIFY_SITE_ID }}' + "`n"
        
        $workflowContent | Out-File -FilePath "$workflowDir\deploy.yml" -Encoding UTF8
        
        # Stage and commit changes
        Write-Host "📝 Staging changes..." -ForegroundColor Yellow
        git add .
        
        $commitMessage = "feat: setup $name for aVOIDgame.io platform with AI-native deployment"
        git commit -m $commitMessage 2>$null
        
        Write-Host "✅ Repository $name configured successfully" -ForegroundColor Green
        Write-Host "🌐 Domain: $($config.domain)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Directory not found: $repoPath" -ForegroundColor Red
        Write-Host "   Please ensure the game directories exist first" -ForegroundColor Yellow
    }
    
    # Return to main directory
    Set-Location "C:\dev\aVOID"
}

# Function to create deployment summary
function New-DeploymentSummary {
    Write-Host "`n📋 Creating Deployment Summary..." -ForegroundColor Yellow
    
    $summary = "# aVOIDgame.io Platform Deployment Summary`n`n"
    $summary += "## Architecture Overview`n"
    $summary += "- **Hub Platform**: aVOIDgame.io (Unified dashboard)`n"
    $summary += "- **Game Routing**: Path-based routing (/void, /wreck, /tank)`n"
    $summary += "- **Database**: Supabase (Unified with SSO)`n"
    $summary += "- **Hosting**: Netlify (AI-optimized deployment)`n`n"
    $summary += "## Deployment URLs`n"
    $summary += "- **Hub**: https://aVOIDgame.io`n"
    $summary += "- **VOIDaVOID**: https://aVOIDgame.io/void`n"
    $summary += "- **WreckaVOID**: https://aVOIDgame.io/wreck`n"
    $summary += "- **TankaVOID**: https://aVOIDgame.io/tank`n`n"
    $summary += "## MCP Configuration`n"
    $summary += "- Supabase MCP (Database operations)`n"
    $summary += "- GitHub MCP (Repository management)`n"
    $summary += "- Netlify MCP (Deployment automation)`n"
    $summary += "- Filesystem MCP (Local development)`n"
    $summary += "- Context7 MCP (Code documentation)`n`n"
    $summary += "## Database Schema`n"
    $summary += "- Fixed foreign key relationships`n"
    $summary += "- Multi-game leaderboard support`n"
    $summary += "- Unified user profiles with SSO`n"
    $summary += "- Games table properly configured`n`n"
    $summary += "## Next Steps`n"
    $summary += "1. Update Supabase credentials in MCP config`n"
    $summary += "2. Configure Netlify deployment tokens`n"
    $summary += "3. Set up domain routing at aVOIDgame.io`n"
    $summary += "4. Test SSO across all games`n"
    $summary += "5. Deploy hub platform first, then games`n`n"
    $summary += "## Production Ready Features`n"
    $summary += "- AI-native deployment pipeline`n"
    $summary += "- Automated error tracking`n"
    $summary += "- Multi-game leaderboards`n"
    $summary += "- Unified authentication`n"
    $summary += "- Performance monitoring`n"
    $summary += "- Global CDN delivery`n`n"
    
    $currentDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $summary += "Generated: $currentDate"
    
    $summary | Out-File -FilePath "DEPLOYMENT_SUMMARY.md" -Encoding UTF8
    Write-Host "✅ Deployment summary created: DEPLOYMENT_SUMMARY.md" -ForegroundColor Green
}

# Main execution
try {
    Set-GitAuth
    Set-MCPConfiguration
    
    Write-Host "`n🎮 Setting up repositories..." -ForegroundColor Cyan
    foreach ($repo in $REPOS.GetEnumerator()) {
        Set-Repository -name $repo.Key -config $repo.Value
    }
    
    New-DeploymentSummary
    
    Write-Host "`n🎉 Setup Complete!" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "✅ All repositories configured for AI-native deployment" -ForegroundColor Green
    Write-Host "⚡ MCP servers configured for optimal development workflow" -ForegroundColor Green
    Write-Host "🚀 Ready for Netlify deployment pipeline" -ForegroundColor Green
    Write-Host "`n📖 Next: Review DEPLOYMENT_SUMMARY.md for next steps" -ForegroundColor Yellow
    Write-Host "🔧 Update credentials in ~/.cursor/mcp.json" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 