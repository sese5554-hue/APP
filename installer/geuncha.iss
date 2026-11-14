#ifndef PayloadDir
  #error PayloadDir is required
#endif
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
[Setup]
AppId={{6248BB70-753B-4D2C-8FF3-78293C9656D1}
AppName=Geuncha
AppVersion={#AppVersion}
AppPublisher=Geuncha
DefaultDirName={localappdata}\Programs\Geuncha
DefaultGroupName=Geuncha
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.19045
OutputDir={#OutputDir}
OutputBaseFilename=Geuncha-Setup-{#AppVersion}-win-x64
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
UninstallDisplayName=Geuncha
SetupLogging=yes
LicenseFile={#PayloadDir}\INSTALL-NOTICE.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Excludes: "prerequisites\*"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\prerequisites\vc_redist.x64.exe"; Flags: dontcopy

[Icons]
Name: "{group}\Geuncha"; Filename: "{app}\Geuncha.cmd"; WorkingDir: "{app}"
Name: "{group}\Geuncha Mobile Test"; Filename: "{app}\Geuncha-Mobile.cmd"; WorkingDir: "{app}"
Name: "{group}\Uninstall Geuncha"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Geuncha"; Filename: "{app}\Geuncha.cmd"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\Geuncha.cmd"; Description: "Start Geuncha (first start creates a local database)"; Flags: postinstall shellexec skipifsilent nowait

[Code]
function RuntimeRegistered(RootKey: Integer): Boolean;
var Installed, Minor: Cardinal;
begin
  Result := RegQueryDWordValue(RootKey, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Installed', Installed) and
    (Installed = 1) and RegQueryDWordValue(RootKey, 'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'Minor', Minor) and (Minor >= 20);
end;

function NeedVisualCpp: Boolean;
var VersionMS, VersionLS: Cardinal;
begin
  Result := not (RuntimeRegistered(HKLM64) or RuntimeRegistered(HKLM32));
  if Result and GetVersionNumbers(ExpandConstant('{sys}\vcruntime140.dll'), VersionMS, VersionLS) then
    if ((VersionMS shr 16) = 14) and ((VersionMS and $FFFF) >= 20) then
      Result := False;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var ExitCode: Integer;
begin
  Result := '';
  if NeedVisualCpp then begin
    ExtractTemporaryFile('vc_redist.x64.exe');
    if not ShellExec('runas', ExpandConstant('{tmp}\vc_redist.x64.exe'), '/install /passive /norestart', '', SW_SHOWNORMAL, ewWaitUntilTerminated, ExitCode) then
      Result := 'Microsoft Visual C++ runtime installation was cancelled or could not start.'
    else if (ExitCode <> 0) and (ExitCode <> 1638) and (ExitCode <> 3010) then
      Result := 'Microsoft Visual C++ runtime installation failed. Exit code: ' + IntToStr(ExitCode)
    else if ExitCode = 3010 then NeedsRestart := True;
  end;
end;
