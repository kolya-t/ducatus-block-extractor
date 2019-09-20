const blockstore = require('bcoin/lib/blockstore');
const axios = require('axios');
const ProgressBar = require('progress');
const program = require('commander');
const resolve = require('path').resolve;
const fs = require('fs');

const http = axios.create({
    baseURL: 'http://insight.ducatus.io/insight-lite-api/'
});

program
    .option('-d --directory <dir>', 'blocks directory')
    .option('-f --from-block <num>', 'from block (inclusive)')
    .option('-t --to-block <num>', 'end block (inclusive)');

program.parse(process.argv);

const directory = resolve(program.directory) || __dirname;
const fromBlock = program.fromBlock || 0;
const toBlock = program.toBlock || 866376;
const count = toBlock - fromBlock + 1;
const secondsDefault = 15;

console.info(`Directory:   ${directory}`);
console.info(`Start block: ${fromBlock}`);
console.info(`End block:   ${toBlock}`);
console.info(`\nExtracting ${count} blocks:`);

const bar = new ProgressBar('[:bar] :rate/bps :percent :etas', {total: count});

(async () => {
    const store = blockstore.create({
        network: 'main',
        prefix: directory
    });

    let parameters = {
        directory: directory,
        fromBlock: fromBlock,
        toBlock: toBlock
    };

    await store.ensure();
    saveBlocks(fromBlock);


    function saveToDisc(parameters) {
        fs.writeFile(directory + '/height.json', JSON.stringify(parameters), (err) => {
            if (err) {
                console.error(err);
                return;
            }
        });
    }

    async function saveBlocks(fromBlock) {
        let blockHash;
        let rawblock;
        // let response;

        for (let height = fromBlock; height <= toBlock; height++) {
            parameters.fromBlock = height;
            saveToDisc(parameters);

            await store.open();
            try {
                // response = await axios.get('http://insight.ducatus.io/insight-lite-api/block-index/' + height);
                blockHash = (await http.get(`block-index/${height}`)).data.blockHash;
                rawblock = (await http.get(`rawblock/${blockHash}`)).data.rawblock;
            } catch (e) {
                if (e.response != null && e.response.status === 429) {
                    seconds = Number(e.response.headers['Retry-After']);
                    if (seconds == null || seconds.isNaN()) {
                        seconds = secondsDefault;
                    }
                }
                console.log(e);
                console.log("Waiting for " + seconds + " seconds..");
                await store.close();
                await sleep(1000 * seconds);
                break;
            }

            const bufferedHash = Buffer.from(blockHash, 'hex');
            const bufferedData = Buffer.from(rawblock, 'hex');

            await store.write(bufferedHash, bufferedData);
            bar.tick(1);

            await store.close();
        }

        if (parameters.fromBlock !== parameters.toBlock) {
            await saveBlocks(parameters.fromBlock);
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

})();