Option Explicit

' 只读指定PID的WMI身份；不输出命令行、环境变量或凭据。
If WScript.Arguments.Count <> 1 Then WScript.Quit 2
Dim rawPid, pid, service, processes, item, count
rawPid = WScript.Arguments(0)
If Not IsNumeric(rawPid) Then WScript.Quit 2
pid = CLng(rawPid)
If pid <= 0 Then WScript.Quit 2
Set service = GetObject("winmgmts:\\.\root\cimv2")
Set processes = service.ExecQuery("SELECT ProcessId, Name, CreationDate FROM Win32_Process WHERE ProcessId=" & pid)
count = 0
For Each item In processes
  count = count + 1
  If count > 1 Or IsNull(item.CreationDate) Then WScript.Quit 3
  WScript.Echo item.ProcessId & vbTab & item.Name & vbTab & item.CreationDate
Next
If count = 0 Then WScript.Echo "absent"
