param(
  [ValidateSet("default", "compile", "generate")]
  [string]$Mode = "default",
  [int]$TimeoutMinutes = 10,
  [int]$PollSeconds = 20
)

$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$stdoutPath = Join-Path $workspace "build-debug-output.log"
$stderrPath = Join-Path $workspace "build-debug-error.log"
$monitorPath = Join-Path $workspace "build-debug-monitor.log"
$exitCodePath = Join-Path $workspace "build-debug-exit-code.log"
$nextPath = Join-Path $workspace ".next"

Remove-Item -LiteralPath $stdoutPath, $stderrPath, $monitorPath, $exitCodePath -Force -ErrorAction SilentlyContinue

function Write-Monitor {
  param([string]$Message)
  $line = "{0:O} {1}" -f (Get-Date), $Message
  Add-Content -LiteralPath $monitorPath -Value $line
  Write-Output $line
}

function Get-ProcessTreeIds {
  param([int]$RootProcessId)

  $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
  $ids = [System.Collections.Generic.HashSet[int]]::new()
  [void]$ids.Add($RootProcessId)

  do {
    $added = $false
    foreach ($process in $processes) {
      if ($ids.Contains([int]$process.ParentProcessId) -and $ids.Add([int]$process.ProcessId)) {
        $added = $true
      }
    }
  } while ($added)

  return @($ids)
}

function Get-NextMetrics {
  if (-not (Test-Path -LiteralPath $nextPath)) {
    return [pscustomobject]@{
      FileCount = 0
      TotalBytes = 0
      LatestWrite = $null
    }
  }

  $files = @(Get-ChildItem -LiteralPath $nextPath -Recurse -File -ErrorAction SilentlyContinue)
  $latest = $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  return [pscustomobject]@{
    FileCount = $files.Count
    TotalBytes = [long](($files | Measure-Object Length -Sum).Sum)
    LatestWrite = $latest.LastWriteTime
  }
}

function Stop-ProcessTree {
  param([int[]]$ProcessIds)

  $ordered = @($ProcessIds | Sort-Object -Descending -Unique)
  foreach ($processId in $ordered) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

$buildCommand = if ($Mode -eq "default") {
  "set NEXT_TELEMETRY_DISABLED=1&& npm run build -- --debug"
} else {
  "set NEXT_TELEMETRY_DISABLED=1&& npx next build --debug --experimental-build-mode $Mode"
}
$commandWithExitCapture = "$buildCommand & set BUILD_EXIT=!ERRORLEVEL! & > `"$exitCodePath`" echo !BUILD_EXIT! & exit /b !BUILD_EXIT!"

Write-Monitor "mode=$Mode timeoutMinutes=$TimeoutMinutes pollSeconds=$PollSeconds"
Write-Monitor "command=$buildCommand"

$process = Start-Process `
  -FilePath $env:ComSpec `
  -ArgumentList "/d", "/v:on", "/s", "/c", "`"$commandWithExitCapture`"" `
  -WorkingDirectory $workspace `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -WindowStyle Hidden `
  -PassThru

$startTime = Get-Date
$deadline = $startTime.AddMinutes($TimeoutMinutes)
$observedIds = [System.Collections.Generic.HashSet[int]]::new()
Write-Monitor "rootPid=$($process.Id) startTime=$($startTime.ToString('O'))"

$timedOut = $false
while (-not $process.HasExited) {
  $treeIds = @(Get-ProcessTreeIds -RootProcessId $process.Id)
  foreach ($processId in $treeIds) {
    [void]$observedIds.Add($processId)
  }

  $stats = @(
    foreach ($processId in $treeIds) {
      Get-Process -Id $processId -ErrorAction SilentlyContinue
    }
  )
  $cpuSeconds = [double](($stats | Measure-Object CPU -Sum).Sum)
  $memoryBytes = [long](($stats | Measure-Object WorkingSet64 -Sum).Sum)
  $nextMetrics = Get-NextMetrics
  $elapsed = (Get-Date) - $startTime

  Write-Monitor (
    "elapsedSeconds={0:N0} pids={1} cpuSeconds={2:N2} memoryBytes={3} nextFiles={4} nextBytes={5} nextLatestWrite={6}" -f `
      $elapsed.TotalSeconds,
      ($treeIds -join ","),
      $cpuSeconds,
      $memoryBytes,
      $nextMetrics.FileCount,
      $nextMetrics.TotalBytes,
      $nextMetrics.LatestWrite
  )

  if ((Get-Date) -ge $deadline) {
    $timedOut = $true
    break
  }

  Start-Sleep -Seconds $PollSeconds
  $process.Refresh()
}

if ($timedOut) {
  $finalTreeIds = @(Get-ProcessTreeIds -RootProcessId $process.Id)
  foreach ($processId in $finalTreeIds) {
    [void]$observedIds.Add($processId)
  }
  Write-Monitor "timeout=true stoppingPids=$(@($observedIds) -join ',')"
  Stop-ProcessTree -ProcessIds @($observedIds)
  Start-Sleep -Seconds 2
  Write-Monitor "exitCode=124"
  exit 124
}

$process.WaitForExit()
$process.Refresh()
$recordedExitCode = if (Test-Path -LiteralPath $exitCodePath) {
  (Get-Content -LiteralPath $exitCodePath -Raw).Trim()
} else {
  ""
}
$exitCode = if ($recordedExitCode -match "^-?\d+$") {
  [int]$recordedExitCode
} elseif ($null -ne $process.ExitCode) {
  [int]$process.ExitCode
} else {
  1
}
$duration = ((Get-Date) - $startTime).TotalSeconds
Write-Monitor "timeout=false durationSeconds=$([math]::Round($duration, 1)) exitCode=$exitCode observedPids=$(@($observedIds) -join ',')"
exit $exitCode
