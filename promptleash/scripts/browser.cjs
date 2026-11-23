const {chromium} = require('playwright');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname,'..');
  const context = await chromium.launchPersistentContext(root+'/.browser-profile',{executablePath:process.env.CHROME_PATH || '/home/ubuntu/.local/bin/google-chrome',headless:false, viewport:{width:1280,height:800},args:['--no-sandbox','--disable-extensions-except='+root,'--load-extension='+root,'--remote-debugging-port=9223']});
  const page = context.pages()[0];
  await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
  console.log('READY',await page.title());
})();
