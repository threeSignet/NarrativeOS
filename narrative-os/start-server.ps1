# 环境变量已在 apps/server/.env 中配置，
# 启动脚本只保证工作目录正确，不覆写任何变量以免冲掉 .env 中的值
Set-Location "$PSScriptRoot\apps\server"
pnpm exec tsx src/index.ts
