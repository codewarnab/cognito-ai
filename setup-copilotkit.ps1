# CopilotKit Setup Script for Chrome AI Extension
# This script helps switch between Chrome AI and CopilotKit implementations

Write-Host "Chrome AI Extension - CopilotKit Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
$originalExists = Test-Path "src/sidepanel.tsx"
$copilotExists = Test-Path "src/sidepanel-copilotkit.tsx"
$chromeAIExists = Test-Path "src/sidepanel-chrome-ai.tsx"

Write-Host "Current file status:" -ForegroundColor Yellow
Write-Host "  src/sidepanel.tsx: $(if ($originalExists) { 'EXISTS' } else { 'NOT FOUND' })"
Write-Host "  src/sidepanel-copilotkit.tsx: $(if ($copilotExists) { 'EXISTS' } else { 'NOT FOUND' })"
Write-Host "  src/sidepanel-chrome-ai.tsx: $(if ($chromeAIExists) { 'EXISTS' } else { 'NOT FOUND' })"
Write-Host ""

# Menu
Write-Host "Select an option:" -ForegroundColor Green
Write-Host "  1. Use CopilotKit version (replace current sidepanel.tsx)"
Write-Host "  2. Use Chrome AI version (revert to original)"
Write-Host "  3. Show current configuration"
Write-Host "  4. Exit"
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Switching to CopilotKit version..." -ForegroundColor Yellow
        
        # Backup current if it's not already backed up
        if ($originalExists -and -not $chromeAIExists) {
            Write-Host "  Backing up current sidepanel.tsx to sidepanel-chrome-ai.tsx"
            Copy-Item "src/sidepanel.tsx" "src/sidepanel-chrome-ai.tsx"
        }
        
        # Copy CopilotKit version
        if ($copilotExists) {
            Write-Host "  Copying sidepanel-copilotkit.tsx to sidepanel.tsx"
            Copy-Item "src/sidepanel-copilotkit.tsx" "src/sidepanel.tsx" -Force
            Write-Host ""
            Write-Host "✓ Successfully switched to CopilotKit version!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "  1. Configure COPILOT_RUNTIME_URL in src/constants.ts"
            Write-Host "  2. Run: pnpm run build"
            Write-Host "  3. Load unpacked extension in Chrome"
        } else {
            Write-Host "  ERROR: sidepanel-copilotkit.tsx not found!" -ForegroundColor Red
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "Reverting to Chrome AI version..." -ForegroundColor Yellow
        
        if ($chromeAIExists) {
            Write-Host "  Copying sidepanel-chrome-ai.tsx to sidepanel.tsx"
            Copy-Item "src/sidepanel-chrome-ai.tsx" "src/sidepanel.tsx" -Force
            Write-Host ""
            Write-Host "✓ Successfully reverted to Chrome AI version!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "  1. Run: pnpm run build"
            Write-Host "  2. Reload extension in Chrome"
        } else {
            Write-Host "  ERROR: sidepanel-chrome-ai.tsx not found!" -ForegroundColor Red
            Write-Host "  The original Chrome AI version may not have been backed up."
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "Current Configuration:" -ForegroundColor Cyan
        Write-Host ""
        
        # Check which version is active
        if ($originalExists) {
            $content = Get-Content "src/sidepanel.tsx" -Raw
            if ($content -match "CopilotKit") {
                Write-Host "  Active Version: CopilotKit" -ForegroundColor Green
                Write-Host ""
                Write-Host "  CopilotKit features enabled:" -ForegroundColor Yellow
                Write-Host "    - Custom UI with external Gemini runtime"
                Write-Host "    - Chrome extension actions (tabs, selection)"
                Write-Host "    - Streaming responses from external API"
            } else {
                Write-Host "  Active Version: Chrome AI (Gemini Nano)" -ForegroundColor Green
                Write-Host ""
                Write-Host "  Chrome AI features enabled:" -ForegroundColor Yellow
                Write-Host "    - On-device Gemini Nano model"
                Write-Host "    - No external API calls"
                Write-Host "    - Local processing"
            }
        } else {
            Write-Host "  ERROR: sidepanel.tsx not found!" -ForegroundColor Red
        }
        
        Write-Host ""
        
        # Check COPILOT_RUNTIME_URL
        if (Test-Path "src/constants.ts") {
            $constantsContent = Get-Content "src/constants.ts" -Raw
            if ($constantsContent -match 'COPILOT_RUNTIME_URL = "([^"]+)"') {
                $url = $matches[1]
                if ($url -eq "https://YOUR-RUNTIME.EXAMPLE/api/copilotkit") {
                    Write-Host "  CopilotKit Runtime: NOT CONFIGURED" -ForegroundColor Red
                    Write-Host "  Please update COPILOT_RUNTIME_URL in src/constants.ts"
                } else {
                    Write-Host "  CopilotKit Runtime: $url" -ForegroundColor Green
                }
            }
        }
    }
    
    "4" {
        Write-Host ""
        Write-Host "Exiting..." -ForegroundColor Yellow
        exit
    }
    
    default {
        Write-Host ""
        Write-Host "Invalid choice. Please run the script again." -ForegroundColor Red
    }
}

Write-Host ""
