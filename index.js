/**
 * Created by pooya on 6/16/19.
 */

// process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/lib/chromium/chromium';
process.env.PUPPETEER_EXECUTABLE_PATH = '/lib/chromium/chromium';

const config = require('config');
const Promise = require('bluebird');
const puppeteer = require('puppeteer');
const uuid = require('uuid/v4');
const urlParser = require('url');

const logger = require('./lib/log/winston');

const tabBreak = 1;
let searchInterval = 0;

const failRate = 50;
const finishRate = 50;
const videoUrl = 'https://www.aparat.com/v/OHRe7';
const headless = false;

const list = {};

async function run() {
  const browser = await puppeteer.launch({
    headless,
    args: ['--proxy-server=socks5://172.26.0.2:9081', '--disable-dev-shm-usage'],
  });

  // const ipPage = await browser.newPage();
  // await ipPage.goto('https://api.ipify.org');

  const videoPage = await browser.newPage();
  const id = uuid();
  list[id] = { finished: false, failed: false, visit: 0, page: videoPage, browser };
  goToVideo(id, browser, videoUrl, videoPage).catch((error) => {
    if (error.message.toString().match(/Target closed/)) {
      return;
    }
    logger.error(error);
  });
}

async function goToVideo(id, browser, url, page) {
  if (list[id].visit > tabBreak) {
    list[id].finished = true;
    return;
  }
  list[id].visit++;

  try {
    logger.info(`Send request for get page "${url}" (browser id: "${id}")`);
    const { protocol: urlProtocol, host: urlHost } = urlParser.parse(url);
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0,
    });

    if (response._status === 200) {
      await play(id, page);
      if (list[id].visit === 1) {
        likeVideo(id, page);
      }
      await page.waitForFunction(
        'Array.from(document.querySelectorAll(".vjs-progress-holder")).filter((el) => Number(el.getAttribute("aria-valuenow")) === 100).length > 0',
        { timeout: 0 },
      );
      const nextUrl = await getNextVideo(page);
      await goToVideo(id, browser, `${urlProtocol}//${urlHost}${nextUrl}`, page);
    } else {
      list[id].failed = true;
    }
  } catch (error) {
    list[id].failed = true;
    throw error;
  }
}

async function play(id, page) {
  logger.info(`Start watching video (browser id: "${id}")`);
  await page.waitForSelector('.vjs-big-play-button');
  await page.$eval('.vjs-big-play-button', (el) => el.click());
}

function likeVideo(id, page) {
  const random = Math.floor(Math.random() * 60) + 30;

  page.waitForFunction(
    `Array.from(document.querySelectorAll(".vjs-progress-holder")).filter((el) => Number(el.getAttribute("aria-valuenow")) >= ${random}).length > 0`,
    { timeout: 0 },
  )
    .then(async () => {
      logger.info(`Like video (browser id: "${id}")`);
      await page.$eval('#likeVideoButton:not(.is-liked)', (el) => el.click());
    })
    .catch((error) => logger.error(error));
}

async function getNextVideo(page) {
  const result = await page.evaluate(() => {
    const data = [];
    $('.thumbnail-video').each(function() {
      const url = $(this)
        .find('a.title')
        .attr('href');
      data.push(url);
    });
    return data;
  });
  const random = Math.floor(Math.random() * result.length);

  return result[random];
}

setInterval(() => {
  if (searchInterval > 5) {
    resetAll();
    return;
  }

  searchInterval++;
  const keys = Object.keys(list);

  const totalFail = keys.filter((v) => list[v].failed);
  if (Math.floor((totalFail * 100) / keys.length) >= failRate) {
    resetAll();
    return;
  }

  const totalFinish = keys.filter((v) => list[v].finished);
  if (Math.floor((totalFinish * 100) / keys.length) < finishRate) {
    return;
  }

  resetAll();
}, 2 * 60 * 1000);

function resetAll() {
  searchInterval = 0;
  Object.keys(list).forEach(async (v) => {
    const { page, browser } = list[v];
    page.close().catch((error) => console.log('close page', error));
    await Promise.delay(1000);
    browser.close().catch((error) => console.log('close Browser', error));
    await Promise.delay(3000);
    delete list[v];
  });
  console.log('should reset tor');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
