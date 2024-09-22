const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const mailgun = require('nodemailer-mailgun-transport');

// Mailgun authentication
const auth = {
  auth: {
    api_key: '1354a1ad2e9608f222da7c3d60f3e834-826eddfb-f40fb0a8',
    domain: 'sandboxa96299ab6cf14953b05ee5228590345a.mailgun.org'
  }
};

// Create a transporter using Nodemailer and Mailgun
const transporter = nodemailer.createTransport(mailgun(auth));

const mainUrl = 'https://www.chittorgarh.com/report/mainboard-ipo-list-in-india-bse-nse/83/';

function parseDate(dateString) {
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  const [month, day, year] = dateString.split(' ');
  return new Date(parseInt(year), months[month], parseInt(day.replace(',', '')));
}

async function fetchPage(url) {
  const response = await axios.get(url);
  return cheerio.load(response.data);
}

async function getGMPInfo(gmpLink) {
  try {
    const $ = await fetchPage(gmpLink);
    const table = $('table.table-bordered');

    const headers = [];
    table.find('thead th').each((i, element) => {
      headers.push($(element).text().trim());
    });

    const rows = [];
    let gmpValue;
    table.find('tbody tr').first().each((i, element) => {
      const row = {};
      $(element).find('td').each((j, cell) => {
        row[headers[j]] = $(cell).text().trim();
      });
      const gmpString = row['Estimated Listing Price'];
      const match = gmpString.match(/₹(\d+)\s*\((-?\d+(?:\.\d+)?)%\)/);
      gmpValue = parseFloat(match[2]);
      rows.push(row);
    });
    return gmpValue;
  } catch (error) {
    console.error(`Error fetching GMP info: ${error.message}`);
    return null;
  }
}

async function getGMPLink(ipoUrl) {
  try {
    const $ = await fetchPage(ipoUrl);
    const gmpLink = $('a[title="IPO GMP"]').attr('href') || 'GMP link not found';
    return gmpLink;
  } catch (error) {
    console.error(`Error fetching GMP link: ${error.message}`);
    return 'Error fetching GMP link';
  }
}

async function sendEmail(ipo, gmpValue) {
  const mailOptions = {
    from: 'Chittorgarh Alerts <mailgun@sandboxa96299ab6cf14953b05ee5228590345a.mailgun.org>',
    to: 'himanshuchachra95@gmail.com, coolhimshu@gmail.com',
    subject: `High GMP Alert: ${ipo['Issuer Company']} IPO`,
    text: `
      The ${ipo['Issuer Company']} IPO currently has a high GMP of ${gmpValue}%.
      
      IPO Details:
      Open Date: ${ipo['Open Date']}
      Close Date: ${ipo['Close Date']}
      Issue Price: ${ipo['Issue Price (Rs)']}
      Lot Size: ${ipo['Lot Size']}
      
      Please review this opportunity.
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.message);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function scrapeWebpage() {
  try {
    const $ = await fetchPage(mainUrl);
    const table = $('table.table-bordered');

    const headers = [];
    table.find('thead th').each((i, element) => {
      headers.push($(element).text().trim());
    });

    const rows = [];
    table.find('tbody tr').each((i, element) => {
      const row = {};
      $(element).find('td').each((j, cell) => {
        row[headers[j]] = $(cell).text().trim();
        if (j === 0) { // Assuming the first column contains the company name with a link
          row['IPO_URL'] = $(cell).find('a').attr('href');
        }
      });
      rows.push(row);
    });

    const currentDate = new Date();

    const openIPOs = rows.filter(row => {
      const openDate = parseDate(row['Open Date']);
      const closeDate = parseDate(row['Close Date']);
      return currentDate >= openDate && currentDate <= closeDate;
    });

    console.log('Currently Open IPOs:');
    for (const ipo of openIPOs) {
      const gmpLink = await getGMPLink(ipo['IPO_URL']);
      const gmpValue = await getGMPInfo(gmpLink);
      console.log(`Issuer Company: ${ipo['Issuer Company']}`);
      console.log(`Open Date: ${ipo['Open Date']}`);
      console.log(`Close Date: ${ipo['Close Date']}`);
      console.log(`Listing Date: ${ipo['Listing Date']}`);
      console.log(`GMP Value: ${gmpValue}%`);
      
      if (gmpValue > 50) {
        await sendEmail(ipo, gmpValue);
      }
    }

    console.log(`\nTotal number of currently open IPOs: ${openIPOs.length}`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

scrapeWebpage();
