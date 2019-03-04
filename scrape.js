const querystring = require('querystring');
const puppeteer = require('puppeteer');
const inquirer = require('inquirer');
const fs = require('mz/fs');
const XLSX = require('xlsx');
const dotenv = require('dotenv').config();



const UACHIEVE_START = "https://uachieve.apps.uillinois.edu/uachieve_uic_shib/student/search.html";
const START_PAGE = 'https://darsweb.admin.uillinois.edu:443/darswebadv_uic/servlet/EASDarsServlet';
// form to GET to for actual dars report:
const DARS_REPORT_URL = "https://darsweb.admin.uillinois.edu/darswebadv_uic/bar";

function uins(fName) {
    // XLSX file with headers "Last Name" "First Name" "UIN"
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

async function download_dars( uin_file, page, start_url) {

    const uin_list = uins(uin_file);

    for (uin_idx in uin_list) {
        const this_uin = uin_list[uin_idx]["UIN"];
        const full_name = uin_list[uin_idx]["First Name"].trim() + " " + uin_list[uin_idx]["Last Name"] + " " + this_uin.trim() + ".pdf";
        if (await fs.exists(full_name)){
            console.log(`${full_name} exists, skipping`);
            continue;
        }
        // student selection
        await page.click('#stuno');
        await page.keyboard.type(this_uin);
        await page.click('input[value="Submit"]');
        await page.waitForNavigation();

        // request a new audit even if one has already been done
        await page.click('a[href="/uachieve_uic_shib/audit/create.html"]')
      await page.waitForNavigation();
      await page.click('#runAudit');

        // start the default selected audit
        await page.click('#SUBMITTABLE > tbody > tr:nth-child(2) > td > input[type="submit"]');
        await page.waitForNavigation();

        // This page auto refreshes, but audits sometimes seem to take forever
        // so wait 5 minutes for timeout
        for(let i = 0; i < 10; i++){
            try{
                await page.waitForSelector('input[value="Open Audit"]', {timeout: 30000});
            }
            catch (err) {
                console.log(`waited for DARS ${i+1} times without finding it, waiting again...`);
                console.log(err);
            }
        }
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

        await page.pdf({path: full_name});
        // await page.screenshot({path: full_name + '.png'});

        await page.goto(start_url);
    }

    // await browser.close();
}

(async () => {
    const infiles = await fs.readdir('input/');
    // turn [f1, f2, f3, f4] into [[name1,f1],[name2,f2] ...]
    const namesfiles = infiles.map((x) => [x.split('_')[2],x]);
    // for each pair
    const browser = await puppeteer.launch(); // {headless: false});
    const page = await browser.newPage();
    await page.goto(UACHIEVE_START);

    await page.click('#netid');
    await page.keyboard.type(process.env.netID);
    await page.click('#easpass');
    await page.keyboard.type(process.env.password);
    await page.click('#easFormId > input');
    await page.waitForNavigation();

    const start_url = page.url();


    for (idx in namesfiles) {
        const elt = namesfiles[idx];
        // make directory, change to directory
        try{
            await fs.mkdir('output/' + elt[0]);
        }
        catch (err) {
            if (err.code === "EEXIST")
                console.log(`directory ${err.path} already exists`);
            else {
                throw err;
            }
        }
        process.chdir('output/' + elt[0]);
        console.log(`processing ${elt[0]}`);

        // dump dars
        await download_dars('../../input/' + elt[1], page, start_url);

        // chdir ..
        process.chdir('../../');

    }
    await browser.close();
})();
