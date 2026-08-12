param([string]$In, [int]$X, [int]$Y)
Add-Type -AssemblyName System.Drawing
$img = New-Object System.Drawing.Bitmap($In)
$px = $img.GetPixel($X, $Y)
Write-Output ("pixel at {0},{1} = R{2} G{3} B{4} (#{2:X2}{3:X2}{4:X2})" -f $X, $Y, $px.R, $px.G, $px.B)
$img.Dispose()
