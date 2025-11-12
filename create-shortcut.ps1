$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\PBS Admin Dev.lnk")
$Shortcut.TargetPath = "C:\Dev\PBS_Admin\start-pbs-admin-dev.bat"
$Shortcut.WorkingDirectory = "C:\Dev\PBS_Admin"
$Shortcut.Description = "Start PBS Admin Development Server"
$Shortcut.Save()
Write-Host "Desktop shortcut created successfully!"
