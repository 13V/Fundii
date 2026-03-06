$env:SUPABASE_URL = "https://gdyjewqeippfnfgyhtkx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeWpld3FlaXBwZm5mZ3lodGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NTU1NCwiZXhwIjoyMDg4MDUxNTU0fQ.ZKEqRtEXocqmhW1cmDLFe3ICl4U-R7pY11MJ5vjXO4E"

# Step 1: Delete all screen_au_ records
Write-Host "Deleting existing screen_au records..."
$headers = @{
    "apikey" = $env:SUPABASE_SERVICE_ROLE_KEY
    "Authorization" = "Bearer " + $env:SUPABASE_SERVICE_ROLE_KEY
    "Content-Type" = "application/json"
}
$deleteUrl = $env:SUPABASE_URL + "/rest/v1/grants?id=like.screen_au_*"
$resp = Invoke-RestMethod -Method Delete -Uri $deleteUrl -Headers $headers
Write-Host "Delete complete."

# Step 2: Run agencyscrapers.py --screen-only to regenerate and push
Write-Host "Regenerating Screen Australia grants..."
& "C:\Python311embed\python.exe" "C:\Users\Administrator\grantmate\scraper\fix_screen_au.py"
