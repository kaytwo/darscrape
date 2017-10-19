const querystring = require('querystring');
const puppeteer = require('puppeteer');
const inquirer = require('inquirer');
const fs = require('mz/fs');
const XLSX = require('xlsx');

// XLSX file with headers "Last Name" "First Name" "UIN"
const UIN_FILE = 'advisees.xlsx';


const START_PAGE = 'https://darsweb.admin.uillinois.edu:443/darswebadv_uic/servlet/EASDarsServlet';
// form to GET to for actual dars report:
const DARS_REPORT_URL = "https://darsweb.admin.uillinois.edu/darswebadv_uic/bar"

function uins(fName) {
    const workbook = XLSX.readFile(fName);
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws);
}

async function lp() {
    return await inquirer.prompt([{
            message: 'Enter your netID',
            name: 'netID'
        },
        {
            type: 'password',
            message: 'Enter your password',
            name: 'password'
        }
    ]);
}

(async() => {
    const uin_list = uins(UIN_FILE);
    const browser = await puppeteer.launch(); // {headless: false});
    const page = await browser.newPage();
    await page.goto(START_PAGE);

    const creds = await lp();
    await page.click('#netid');
    await page.keyboard.type(creds.netID);
    await page.click('#easpass');
    await page.keyboard.type(creds.password);
    await page.click('#easFormId > input');
    await page.waitForNavigation();

    // database login
    await page.evaluate(() => {
        // CFQ is College of Engineering
        document.querySelector('select').value = "CFQ";
    });
    await page.click('input[type="submit"]');
    await page.waitForNavigation();


    // save off this url to go back to to repeat the process
    const STUDENT_SELECTION_URL = page.url();

    for (uin_idx in uin_list) {
        const this_uin = uin_list[uin_idx]["UIN"];
        const full_name = uin_list[uin_idx]["First Name"].trim() + " " + uin_list[uin_idx]["Last Name"];
        // student selection
        await page.click('#userID');
        await page.keyboard.type(this_uin);
        await page.click('input[value="Continue"]');
        await page.waitForNavigation();

        // click audits dropdown
        await page.click("#main > div > a:nth-child(5)");
        // start new audit
        await page.click("#menuAUDITS > a:nth-child(2)");
        await page.waitForNavigation();

        // start the default selected audit
        await page.click('#SUBMITTABLE > tbody > tr:nth-child(2) > td > input[type="submit"]');
        await page.waitForNavigation();

        // The page was auto refreshing once the audit was done for me, so just
        // wait for that to happen...
        await page.waitForSelector('input[value="Open Audit"]');
        let report_query = await page.evaluate(() => {
            var retval = {};
            retval.instidq = document.querySelector('input[name="instidq"]').value;
            retval.instid = document.querySelector('input[name="instid"]').value;
            retval.instcd = document.querySelector('input[name="instcd"]').value;
            retval.DETAILS = document.querySelector('input[name="DETAILS"]').value;
            var sourcecode = document.querySelector('input[value="Open Audit"]').onclick.toString().split("'");
            retval.job_id = sourcecode[1];
            retval.int_seq_no = sourcecode[3];
            return retval;
        });
        await page.goto(DARS_REPORT_URL + "?" + querystring.stringify(report_query));

        // on the audit page - get printer friendly version
        await page.waitForSelector('#openAllLink');
        await page.click('#openAllLink');

        await page.pdf({path: full_name + '.pdf'});
        // await page.screenshot({path: full_name + '.png'});

        await page.goto(STUDENT_SELECTION_URL);
    }

    await browser.close();
})();
