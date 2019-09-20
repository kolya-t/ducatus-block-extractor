const blockstore = require('bcoin/lib/blockstore');
const axios = require('axios');
const ProgressBar = require('progress');
const program = require('commander');
const resolve = require('path').resolve;
// const fs = require('fs');
const fs = require('fs-extra')

const http = axios.create({
    baseURL: 'http://insight.ducatus.io/insight-lite-api/'
});

program
    .option('-d --directory <dir>', 'blocks directory')
    .option('-f --from-block <num>', 'from block (inclusive)')
    .option('-t --to-block <num>', 'end block (inclusive)');

program.parse(process.argv);

const logFile = 'extractor.log';
const lastBLockFile = 'lastBlock';
const directory = program.directory ? resolve(program.directory) : __dirname;
let fromBlock = program.fromBlock || 0;
if (fs.existsSync(lastBLockFile)) {
    fromBlock = Number(fs.readFileSync(lastBLockFile)) + 1;
}

const toBlock = program.toBlock || 866376;
const count = toBlock - fromBlock + 1;

console.info(`Directory:   ${directory}`);
console.info(`Start block: ${fromBlock}`);
console.info(`End block:   ${toBlock}`);
console.info(`\nExtracting ${count} blocks:`);

const bar = new ProgressBar('[:bar] :rate b/ps :percent :etas', { total: count });

(async () => {
    const store = blockstore.create({
        network: 'main',
        prefix: directory
    });

    await store.ensure();
    fs.ensureFileSync(logFile);

    let height = fromBlock;
    while (height <= toBlock) {
        await store.open();

        let blockHash;
        let rawblock;

        try {
            blockHash = (await http.get(`block-index/${height}`)).data.blockHash;
            rawblock = (await http.get(`rawblock/${blockHash}`)).data.rawblock;
        } catch ({ response: { headers } }) {
            if (headers['Retry-After']) {
                const waitSeconds = Number(headers['Retry-After']);
                await sleep(waitSeconds);
            }

            continue;
        }

        const bufferedHash = Buffer.from(blockHash, 'hex');
        const bufferedData = Buffer.from(rawblock, 'hex');

        await store.write(bufferedHash, bufferedData);
        fs.appendFileSync(logFile, `${new Date()}: wrote block ${height}\n`);
        fs.ensureFileSync(lastBLockFile);
        fs.writeFileSync(lastBLockFile, height);
        bar.tick(1);

        await store.close();

        height++;
    }
})();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
