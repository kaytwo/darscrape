const puppeteer = require('puppeteer');
const inquirer = require('inquirer');

const START_PAGE = 'https://darsweb.admin.uillinois.edu:443/darswebadv_uic/servlet/EASDarsServlet';
const USERNAME_SELECTOR = '#netid';
const PASSWORD_SELECTOR = '#easpass';
const SUBMIT_SELECTOR = '#easFormId > input';


async function lp () {
    return await inquirer.prompt([
        {
          message: 'Enter your netID',
          name: 'netID'
        },
        {
          type: 'password',
          message: 'Enter your password',
          name: 'password'
        }]);
    }


(async () => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await page.goto(START_PAGE);
    const CREDS = await lp();
    
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(CREDS.netID);
    
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(CREDS.password);
    
    await page.click(SUBMIT_SELECTOR);
    
    await page.waitForNavigation();

    await page.evaluate(() => {
        $('select').value = "CFQ";
    });
  
    /*
  
 
  await page.goto('https://news.ycombinator.com', {waitUntil: 'networkidle'});
  await page.pdf({path: 'hn.pdf'});

  await browser.close();
  */
})();
