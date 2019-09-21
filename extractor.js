const blockstore = require('bcoin/lib/blockstore');
const axios = require('axios');
const ProgressBar = require('progress');
const program = require('commander');
const resolve = require('path').resolve;
// const fs = require('fs');
const fs = require('fs-extra');

const http = axios.create({
    baseURL: 'http://insight.ducatus.io/insight-lite-api/'
});

program
    .option('-d --directory <dir>', 'blocks directory')
    .option('-f --from-block <num>', 'from block (inclusive)')
    .option('-t --to-block <num>', 'end block (inclusive)')
    .option('-i --interval <num>', 'retry interval in seconds (default is 10 minutes)');

program.parse(process.argv);

const logFile = 'extractor.log';
const lastBLockFile = 'lastBlock';
const defaultRetryInterval = program.interval || 60; // default is minute
const directory = program.directory ? resolve(program.directory) : __dirname;
let fromBlock = program.fromBlock || 0;
if (fs.existsSync(lastBLockFile)) {
    fromBlock = Number(fs.readFileSync(lastBLockFile)) + 1;
}

const toBlock = program.toBlock || 866376;
const count = toBlock - fromBlock + 1;

console.info(`Directory:        ${directory}`);
console.info(`Retry interval:   ${defaultRetryInterval}s`);
console.info(`Start block:      ${fromBlock}`);
console.info(`End block:        ${toBlock}`);
console.info(`\nExtracting ${count} blocks:`);

const bar = new ProgressBar('[:bar] :rate b/ps :percent :etas', { total: count });

(async () => {
    const store = blockstore.create({
        network: 'main',
        prefix: directory
    });

    await store.ensure();

    let retryInterval = defaultRetryInterval;
    let height = fromBlock;
    while (height <= toBlock) {
        try {
            await store.open();
            const blockHash = (await http.get(`block-index/${height}`)).data.blockHash;
            const rawblock = (await http.get(`rawblock/${blockHash}`)).data.rawblock;

            const bufferedHash = Buffer.from(blockHash, 'hex');
            const bufferedData = Buffer.from(rawblock, 'hex');

            await store.write(bufferedHash, bufferedData);
            log(`wrote block ${height}`);
            writeLastBlock(height);
            bar.tick(1);
            height++;
            retryInterval = defaultRetryInterval;
        } catch (e) {
            log(e);
            await sleep(retryInterval * 1000);
            retryInterval *= 2;
        } finally {
            await store.close();
        }
    }
})();

function log(message) {
    fs.ensureFileSync(logFile);
    fs.appendFileSync(logFile, `${new Date()}: ${message}\n`);
}

function writeLastBlock(newLastBlock) {
    fs.ensureFileSync(lastBLockFile);
    fs.writeFileSync(lastBLockFile, newLastBlock);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
