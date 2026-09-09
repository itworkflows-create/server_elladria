param([string]$Ffmpeg = "$PSScriptRoot\..\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe")
$ErrorActionPreference = 'Stop'
$assetDirectory = [IO.Path]::GetFullPath("$PSScriptRoot\..\public\demo")
[IO.Directory]::CreateDirectory($assetDirectory) | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression
# Synthetic artwork, not a photograph of a real employee.
$bitmap = New-Object System.Drawing.Bitmap 1280,720
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([Drawing.ColorTranslator]::FromHtml('#eaf0e5'))
$brush = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#214a38'))
$accent = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#b0c798'))
$graphics.FillEllipse($accent, 880, 70, 500, 500)
$font = New-Object Drawing.Font 'Arial',48
$smallFont = New-Object Drawing.Font 'Arial',24
$graphics.DrawString('Welcome to Elladria', $font, $brush, 75, 220)
$graphics.DrawString('Your workspace, connected.', $smallFont, $brush, 80, 320)
$graphics.DrawString('SYNTHETIC DEMO ASSET', $smallFont, $brush, 80, 570)
$bitmap.Save("$assetDirectory\team-onboarding.jpg", [Drawing.Imaging.ImageFormat]::Jpeg)
$graphics.Dispose(); $bitmap.Dispose(); $brush.Dispose(); $accent.Dispose(); $font.Dispose(); $smallFont.Dispose()
& $Ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=6' -af 'volume=0.15,afade=t=in:d=0.3,afade=t=out:st=5:d=1' -c:a pcm_s16le "$assetDirectory\welcome-audio-cue.wav"
if ($LASTEXITCODE -ne 0) { throw 'WAV generation failed' }
& $Ffmpeg -hide_banner -loglevel error -y -i "$assetDirectory\welcome-audio-cue.wav" -c:a libmp3lame -b:a 192k "$assetDirectory\interview-sound-check.mp3"
if ($LASTEXITCODE -ne 0) { throw 'MP3 generation failed' }
& $Ffmpeg -hide_banner -loglevel error -y -loop 1 -i "$assetDirectory\team-onboarding.jpg" -i "$assetDirectory\welcome-audio-cue.wav" -t 6 -r 24 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$assetDirectory\workspace-training.mp4"
if ($LASTEXITCODE -ne 0) { throw 'MP4 generation failed' }
# A minimal Office Open XML document, created locally with no external content.
$docxPath = "$assetDirectory\employee-handbook.docx"
$stream = [IO.File]::Open($docxPath, [IO.FileMode]::Create)
$zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
$entries = @{
  '[Content_Types].xml' = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  '_rels/.rels' = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  'word/document.xml' = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Elladria - Demo employee handbook</w:t></w:r></w:p><w:p><w:r><w:t>Welcome to your connected workspace. This is a synthetic sample document, not a company policy.</w:t></w:r></w:p></w:body></w:document>'
}
foreach ($entry in $entries.GetEnumerator()) { $writer = New-Object IO.StreamWriter($zip.CreateEntry($entry.Key).Open()); $writer.Write($entry.Value); $writer.Dispose() }
$zip.Dispose(); $stream.Dispose()
Get-ChildItem -LiteralPath $assetDirectory | Select-Object Name,Length
