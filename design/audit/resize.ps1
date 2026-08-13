param([int]$TargetPid, [int]$X = 100, [int]$Y = 38, [int]$W = 1800, [int]$H = 1125)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
}
"@
[W]::SetProcessDPIAware() | Out-Null
$p = Get-Process -Id $TargetPid
[W]::MoveWindow($p.MainWindowHandle, $X, $Y, $W, $H, $true) | Out-Null
Write-Output "moved pid $TargetPid to $X,$Y ${W}x${H}"
