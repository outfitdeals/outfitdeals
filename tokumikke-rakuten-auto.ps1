param(
    [ValidateSet("Install", "Run")][string]$Mode = "Run",
    [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')][string]$DailyAt = "09:00",
    [ValidateRange(1, 10)][int]$MaxRuns = 10,
    [ValidateRange(30, 1440)][int]$IntervalMinutes = 60
)

$ErrorActionPreference = "Stop"
$taskName = "Tokumikke-Rakuten-AutoPost"
$apiUrl = "https://www.tokumikke.com/api/rakuten-auto-post"
$dataDir = Join-Path $env:LOCALAPPDATA "TokumikkeRakuten"
$keyPath = Join-Path $dataDir "api-key.dpapi"
$logDir = Join-Path $dataDir "logs"
New-Item -ItemType Directory -Force -Path $dataDir, $logDir | Out-Null

function Write-RunLog([string]$Message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $line
    $logFile = Join-Path $logDir ("run-" + (Get-Date -Format "yyyy-MM-dd") + ".log")
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

if ($Mode -eq "Install") {
    $secureKey = Read-Host "CRON_SECRET を入力（非表示）" -AsSecureString
    if ($secureKey.Length -eq 0) { throw "シークレットが空です。" }
    $secureKey | ConvertFrom-SecureString | Set-Content -LiteralPath $keyPath -Encoding ASCII

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $psExe = Join-Path $PSHOME "powershell.exe"
    $argsForTask = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
                   $PSCommandPath + '" -Mode Run -MaxRuns 10 -IntervalMinutes 60'

    $action = New-ScheduledTaskAction -Execute $psExe -Argument $argsForTask
    $at = [datetime]::ParseExact(
        $DailyAt, "HH:mm", [Globalization.CultureInfo]::InvariantCulture
    )
    $trigger = New-ScheduledTaskTrigger -Daily -At $at
    $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit (New-TimeSpan -Hours 12) -StartWhenAvailable

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "登録完了。毎日 $DailyAt (PCのローカル時刻) に起動します。"
    Write-Host "同じWindowsユーザーがログイン中の場合に動作します。"
    Write-Host "ログ: $logDir"
    exit 0
}

$mutex = [Threading.Mutex]::new($false, "Local\TokumikkeRakutenAutoPost")
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) {
        Write-RunLog "別の実行が進行中のため終了。"
        return
    }
    if (-not (Test-Path -LiteralPath $keyPath)) {
        throw "APIキー未設定。-Mode Install を先に実行してください。"
    }

    $encryptedKey = (Get-Content -LiteralPath $keyPath -Raw -Encoding ASCII).Trim()
    if ([string]::IsNullOrWhiteSpace($encryptedKey)) { throw "暗号化キー保存ファイルが空です。" }
    $secureKey = ConvertTo-SecureString -String $encryptedKey -ErrorAction Stop
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try { $secret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }

    if ([string]::IsNullOrWhiteSpace($secret)) { throw "APIキーを読み取れませんでした。" }
    Write-RunLog "開始。最大 $MaxRuns 回 / 終了後 $IntervalMinutes 分待機。"

    for ($i = 1; $i -le $MaxRuns; $i++) {
        Write-RunLog "API実行 $i / $MaxRuns"
        try {
            $result = Invoke-RestMethod -Uri $apiUrl -Method GET `
                -Headers @{ Authorization = "Bearer $secret" } `
                -TimeoutSec 360 -ErrorAction Stop
        }
        catch {
            Write-RunLog ("APIエラーのため停止: " + $_.Exception.Message)
            break
        }
        if ($null -eq $result -or $result.ok -ne $true) {
            Write-RunLog "正常応答ではないため停止。"
            break
        }
        if ($result.skipped -eq $true) {
            Write-RunLog ("実行スキップ: " + [string]$result.reason)
            break
        }

        Write-RunLog ("投稿=" + [string]$result.postedCount +
            " 重複=" + [string]$result.duplicateCount +
            " AI失敗=" + [string]$result.aiFailureCount +
            " 時間打切=" + [string]$result.stoppedForTime)

        if ($result.stoppedForTime -eq $false) {
            Write-RunLog "今回の処理は時間打切なしで終了。次回も予定どおり実行。"
        }
        if ($i -lt $MaxRuns) {
            Write-RunLog "$IntervalMinutes 分待機。"
            Start-Sleep -Seconds ($IntervalMinutes * 60)
        }
    }
    Write-RunLog "処理終了。"
}
catch {
    Write-RunLog ("スクリプトエラー: " + $_.Exception.Message)
    exit 1
}
finally {
    Remove-Variable secret -ErrorAction SilentlyContinue
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
