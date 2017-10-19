const querystring = require('querystring');
const puppeteer = require('puppeteer');
const inquirer = require('inquirer');
const fs = require('mz/fs');

const TEST_UIN = '674640002';
const UIN_FILE = 'uins.txt';
const START_PAGE = 'https://darsweb.admin.uillinois.edu:443/darswebadv_uic/servlet/EASDarsServlet';
const USERNAME_SELECTOR = '#netid';
const PASSWORD_SELECTOR = '#easpass';
const SUBMIT_SELECTOR = '#easFormId > input';
// on Dars Database Login screen...
const LOGIN_SELECTOR = 'input[type="submit"]';
// on Dars enter UIN screen...
const UIN_TEXTBOX_SELECTOR = '#userID';
const CONTINUE_BUTTON = 'input[value="Continue"]';

// form to GET to for actual dars report:
const DARS_REPORT_URL = "https://darsweb.admin.uillinois.edu/darswebadv_uic/bar"

async function uins (fName) {
    const rawfile = await fs.readFile(fName);
    const uins = rawfile.toString().split('\n').filter((x) => x.length > 0);
    console.log(uins);
}

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
    const browser = await puppeteer.launch(); // {headless: false});
    const page = await browser.newPage();

    // new tab workaround from https://github.com/GoogleChrome/puppeteer/issues/386#issuecomment-336590028


    await page.goto(START_PAGE);
    await page.evaluate(() => {
        window.open = (new_url) => {
            console.log("intercepted window.open");
            window.location.href = new_url}
    });


    const creds = await lp();
    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(creds.netID);
    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(creds.password);
    await page.click(SUBMIT_SELECTOR);
    await page.waitForNavigation();

    // database login
    await page.evaluate(() => {
        // CFQ is College of Engineering
        document.querySelector('select').value="CFQ";
    });
    await page.click(LOGIN_SELECTOR);
    await page.waitForNavigation();
    
    
    // save off this url to go back to to repeat the process
    const STUDENT_SELECTION_URL = page.url(); 
    
    // student selection
    await page.click(UIN_TEXTBOX_SELECTOR);
    await page.keyboard.type(TEST_UIN);
    await page.click(CONTINUE_BUTTON);
    await page.waitForNavigation();

    // click audits dropdown
    await page.click("#main > div > a:nth-child(5)");
    // start new audit
    await page.click("#menuAUDITS > a:nth-child(2)");
    await page.waitForNavigation();

    // start the default selected audit
    await page.click('#SUBMITTABLE > tbody > tr:nth-child(2) > td > input[type="submit"]');
    await page.waitForNavigation();

    await page.waitForSelector('input[value="Open Audit"]');
    /* alternate slow way
    await page.waitFor(3000);
    await page.click('input[value="Refresh List"]');
    await page.waitForNavigation();
    */  
    let report_query  = await page.evaluate(() => {
        var retval = {};
        retval.instidq = document.querySelector('input[name="instidq"]').value;
        retval.instid  = document.querySelector('input[name="instid"]').value;
        retval.instcd  = document.querySelector('input[name="instcd"]').value;
        retval.DETAILS = document.querySelector('input[name="DETAILS"]').value;
        var sourcecode = document.querySelector('input[value="Open Audit"]').onclick.toString().split("'");
        retval.job_id = sourcecode[1];
        retval.int_seq_no = sourcecode[3];
        return retval;
    });
    await page.goto(DARS_REPORT_URL + "?" + querystring.stringify(report_query));
    // await page.waitForNavigation();

    // on the audit page - get printer friendly version
    // await page.waitFor(1500);
    await page.click('#openAllLink');
    await page.pdf({path: TEST_UIN + '.pdf'});
    // await page.screenshot({path: TEST_UIN + '.png'});


    
    
    
    // await browser.close();
})();

/*
(async () => {
    await uins(UIN_FILE);
})();
*/
