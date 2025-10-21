# Script to remove custom registerToolUI calls from action files
# This allows them to use the default CompactToolRenderer

Write-Host "Removing custom registerToolUI calls from action files..." -ForegroundColor Green

# List of files with registerToolUI calls (excluding the ones already updated)
$filesToUpdate = @(
    "src/actions/interactions/keyboard-interactions.tsx",
    "src/actions/interactions/getSearchResults.tsx",
    "src/actions/interactions/scroll.tsx",
    "src/actions/interactions/search.tsx",
    "src/actions/interactions/extractText.tsx",
    "src/actions/tabs/navigateTo.tsx",
    "src/actions/tabs/switchTabs.tsx",
    "src/actions/tabs/getActiveTab.tsx",
    "src/actions/tabs/applyTabGroups.tsx",
    "src/actions/tabs/organizeTabsByContext.tsx",
    "src/actions/tabs/ungroupTabs.tsx",
    "src/actions/memory/saveMemory.tsx",
    "src/actions/memory/getMemory.tsx",
    "src/actions/memory/deleteMemory.tsx",
    "src/actions/memory/listMemories.tsx",
    "src/actions/memory/suggestSaveMemory.tsx",
    "src/actions/history/searchHistory.tsx",
    "src/actions/history/getRecentHistory.tsx",
    "src/actions/history/getUrlVisits.tsx",
    "src/actions/reminder/createReminder.tsx",
    "src/actions/reminder/cancelReminder.tsx",
    "src/actions/reminder/listReminders.tsx",
    "src/actions/selection.tsx",
    "src/actions/youtube/index.tsx"
)

$updatedCount = 0
$errorCount = 0

foreach ($file in $filesToUpdate) {
    $fullPath = Join-Path $PSScriptRoot $file
    
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file" -ForegroundColor Yellow
        
        try {
            $content = Get-Content $fullPath -Raw
            
            # Pattern to match registerToolUI calls (multi-line, handles various formatting)
            # This regex matches from 'registerToolUI(' to the matching closing ');'
            $pattern = 'registerToolUI\([^,]+,\s*\([^)]+\)\s*=>\s*\{[\s\S]*?\}\);'
            
            # Replace with a simple comment
            $newContent = $content -replace $pattern, '// Using default CompactToolRenderer - no custom UI needed'
            
            if ($content -ne $newContent) {
                Set-Content -Path $fullPath -Value $newContent -NoNewline
                Write-Host "  ✓ Updated" -ForegroundColor Green
                $updatedCount++
            } else {
                Write-Host "  - No changes needed" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "  ✗ Error: $_" -ForegroundColor Red
            $errorCount++
        }
    } else {
        Write-Host "  ! File not found: $fullPath" -ForegroundColor Magenta
    }
}

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Updated: $updatedCount files" -ForegroundColor Green
Write-Host "  Errors: $errorCount files" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "`nNote: Manual review recommended for complex registerToolUI patterns" -ForegroundColor Yellow
