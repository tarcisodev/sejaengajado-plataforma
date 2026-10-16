# Windows: .\labels.ps1 [-Repo owner/repo]
param([string]$Repo)
Get-Content "$PSScriptRoot\labels.yml" | Where-Object { $_ -match '^- \{name: "([^"]+)", *color: "([^"]+)", *description: "([^"]*)"' } | ForEach-Object {
  $a = @('label','create',$Matches[1],'--color',$Matches[2],'--description',$Matches[3],'--force'); if ($Repo) { $a += @('--repo',$Repo) }; & gh @a }
