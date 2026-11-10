; NISAR Pro Windows installer (Inno Setup 6)
;
; Build on Windows after the release folder is assembled:
;   iscc /DSourceDir="C:\path\to\NISAR-Pro-1.0.0" /O"C:\path\to\out" installer\windows\NISAR-Pro.iss
;
; Installs for the current user only (no admin needed) into
; %LOCALAPPDATA%\Programs\NISAR Pro, so the app can write its results next to itself.

#define AppName "NISAR Pro"
#define AppVersion "1.0.0"
#define AppExe "NISAR Pro.exe"
#ifndef SourceDir
  #define SourceDir "..\..\NISAR-Pro-1.0.0"
#endif

[Setup]
AppId={{8C1B6E2A-4F1D-4E7B-9C51-5B2A6E0D7A11}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=RunLayer Labs
AppPublisherURL=https://github.com/AdityaNarayanNayak-2/NISAR_PRO
AppSupportURL=https://github.com/AdityaNarayanNayak-2/NISAR_PRO/issues
VersionInfoVersion={#AppVersion}
VersionInfoDescription={#AppName} - NISAR SAR water mapping
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=..\..\LICENSE
SetupIconFile=nisar-pro.ico
UninstallDisplayIcon={app}\nisar-pro.ico
UninstallDisplayName={#AppName}
OutputBaseFilename=NISAR-Pro-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "nisar-pro.ico"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\sar-gateway\results"

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\nisar-pro.ico"; Comment: "Start NISAR Pro and open the dashboard"
Name: "{autoprograms}\Stop {#AppName}"; Filename: "{app}\{#AppExe}"; Parameters: "--stop"; IconFilename: "{app}\nisar-pro.ico"; Comment: "Stop the NISAR Pro server"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\nisar-pro.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/IM sar-gateway.exe /F"; Flags: runhidden; RunOnceId: "StopGateway"
Filename: "{sys}\taskkill.exe"; Parameters: "/IM sar_science_processor.exe /F"; Flags: runhidden; RunOnceId: "StopEngine"

[Code]
// Stop a running copy before files are replaced during an upgrade.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM sar-gateway.exe /F', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM sar_science_processor.exe /F', '', SW_HIDE, ewWaitUntilTerminated, Code);
  Result := '';
end;
