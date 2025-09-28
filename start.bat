@echo off
title JuneAI
color 0A

cd %~dp0

echo Configuration files checked.

echo Checking dependencies...
if exist "..\node_modules" (
    echo Using node_modules from parent directory...
    cd ..
    CALL npm install dotenv puppeteer puppeteer-extra puppeteer-extra-plugin-stealth https-proxy-agent
    cd %~dp0
) else (
    echo Installing dependencies in current directory...
    CALL npm install dotenv puppeteer puppeteer-extra puppeteer-extra-plugin-stealth https-proxy-agent
)
echo Dependencies installation completed!
title JuneAI
echo Starting the bot...
node june.js

pause
exit
