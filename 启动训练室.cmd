@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Focus Room - 专注训练室
where node >nul 2>&1
if errorlevel 1 (
  echo 请先安装 Node.js 22.13 或更高版本。
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo 正在安装项目依赖...
  call npm.cmd ci
  if errorlevel 1 goto failed
)
echo 专注训练室即将启动。
echo 请保持此窗口开启，在浏览器打开下面显示的 Local 地址。
echo 按 Ctrl+C 可以停止运行。
call npm.cmd run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo 启动失败，请查看上方提示。
pause
exit /b 1
