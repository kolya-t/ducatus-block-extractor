const blockstore = require('bcoin/lib/blockstore');
const axios = require('axios');
const ProgressBar = require('progress');
const program = require('commander');

const http = axios.create({
    baseURL: 'http://insight.ducatus.io/insight-lite-api/'
});

program
    .option('-d --directory', 'blocks directory')
    .option('-f --from-block <num>', 'from block (inclusive)')
    .option('-t --to-block <num>', 'end block (inclusive)');

program.parse(process.argv);

const directory = program.directory || __dirname;
const fromBlock = program.fromBlock || 0;
const toBlock = program.toBlock || 866376;
const count = toBlock - fromBlock + 1;

console.info(`Directory:   ${directory}`);
console.info(`Start block: ${fromBlock}`);
console.info(`End block:   ${toBlock}`);
console.info(`\nExtracting ${count} blocks:`);

const bar = new ProgressBar('[:bar] :rate/bps :percent :etas', { total: count });

(async () => {
    const store = blockstore.create({
        network: 'main',
        prefix: directory
    });

    await store.ensure();
    await store.open();

    for (let height = fromBlock; height <= toBlock; height++) {
        const { data: { blockHash } } = await http.get(`block-index/${height}`);
        const { data: { rawblock } } = await http.get(`rawblock/${blockHash}`);

        const bufferedHash = Buffer.from(blockHash, 'hex');
        const bufferedData = Buffer.from(rawblock, 'hex');

        await store.write(bufferedHash, bufferedData);
        bar.tick(1);
    }

    await store.close();
})();