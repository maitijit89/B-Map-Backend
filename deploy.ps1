<#
.SYNOPSIS
Deploys the B-Map Backend to Google Cloud Run.

.DESCRIPTION
This script builds and deploys the application to Google Cloud Run,
configuring the connection to Google Cloud SQL.

.EXAMPLE
.\deploy.ps1 -Project "rich-channel-478315-d6" -InstanceName "my-instance" -Region "us-central1"
#>
param (
    [string]$Project = "rich-channel-478315-d6",
    [string]$InstanceName,
    [string]$Region = "us-central1",
    [string]$ServiceName = "b-map-backend",
    [string]$DbUser,
    [string]$DbPassword,
    [string]$DbName
)

if (-not $InstanceName -or -not $DbUser -or -not $DbPassword -or -not $DbName) {
    Write-Host "Error: Missing required parameters. Please provide InstanceName, DbUser, DbPassword, and DbName." -ForegroundColor Red
    Write-Host "Example:"
    Write-Host ".\deploy.ps1 -InstanceName 'my-db' -DbUser 'postgres' -DbPassword 'secret' -DbName 'bmap'"
    exit 1
}

$CloudSqlInstance = "$Project:$Region:$InstanceName"

Write-Host "Deploying to Google Cloud Run in project $Project..." -ForegroundColor Cyan
Write-Host "Connecting to Cloud SQL Instance: $CloudSqlInstance" -ForegroundColor Cyan

# Deploy to Cloud Run
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --project $Project `
    --allow-unauthenticated `
    --add-cloudsql-instances $CloudSqlInstance `
    --set-env-vars="CLOUD_SQL_INSTANCE_NAME=$CloudSqlInstance,DB_USER=$DbUser,DB_PASSWORD=$DbPassword,DB_NAME=$DbName,ENV=production"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Deployment failed." -ForegroundColor Red
}
