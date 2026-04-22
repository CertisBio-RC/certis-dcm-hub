py .\scripts\combine_retailers_breakout_to_combined.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

py .\scripts\combine_kingpins_breakout_to_combined.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Combined workbook refresh complete."
Write-Host "Outputs created in .\data\ :"
Write-Host " - Channel Partners and Kingpins Map - COMBINED.xlsx"
Write-Host " - RC Kingpins for AgRoute - COMBINED.xlsx"