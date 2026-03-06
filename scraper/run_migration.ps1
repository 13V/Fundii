$env:SUPABASE_URL = "https://gdyjewqeippfnfgyhtkx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkeWpld3FlaXBwZm5mZ3lodGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ3NTU1NCwiZXhwIjoyMDg4MDUxNTU0fQ.ZKEqRtEXocqmhW1cmDLFe3ICl4U-R7pY11MJ5vjXO4E"

$sql = Get-Content "C:\Users\Administrator\grantmate\supabase\002_leads_purchases_applications.sql" -Raw

$headers = @{
    "apikey" = $env:SUPABASE_SERVICE_ROLE_KEY
    "Authorization" = "Bearer " + $env:SUPABASE_SERVICE_ROLE_KEY
    "Content-Type" = "application/json"
}

$body = @{ query = $sql } | ConvertTo-Json

$resp = Invoke-RestMethod -Method Post -Uri ($env:SUPABASE_URL + "/rest/v1/rpc/exec_sql") -Headers $headers -Body $body -ErrorAction SilentlyContinue

Write-Host "Migration response: $resp"
Write-Host "Done."
