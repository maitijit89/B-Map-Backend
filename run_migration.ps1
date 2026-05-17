# Prompt for access token and database password securely
$AccessToken = Read-Host "Enter your Supabase Access Token (Get it from https://supabase.com/dashboard/account/tokens)"
$Password = Read-Host "Enter your Supabase Database Password"

# Set environment variable for the duration of this session
$env:SUPABASE_ACCESS_TOKEN = $AccessToken

Write-Host "Linking project to oqrvudpkthskccruciza..." -ForegroundColor Cyan
npx supabase link --project-ref oqrvudpkthskccruciza --password $Password

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to link project. Please verify your password and access token." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Creating new migration called 'new-migration'..." -ForegroundColor Cyan
npx supabase migration new new-migration

Write-Host "Pushing migration to remote database..." -ForegroundColor Cyan
npx supabase db push --password $Password

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to push migrations." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Migrations completed and pushed successfully!" -ForegroundColor Green
