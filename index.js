const blockstore = require('bcoin/lib/blockstore');
const axios = require('axios');

const http = axios.create({
    baseURL: 'http://insight.ducatus.io/insight-lite-api/'
});

(async () => {
    const store = blockstore.create({
        network: 'main',
        prefix: '/home/kolya-t/Projects/bcoin-test'
    });

    await store.ensure();
    await store.open();

    for (let height = 0; height < 40; height++) {
        const { data: { blockHash } } = await http.get(`block-index/${height}`);
        const { data: { rawblock } } = await http.get(`rawblock/${blockHash}`);

        const bufferedHash = Buffer.from(blockHash, 'hex');
        const bufferedData = Buffer.from(rawblock, 'hex');

        await store.write(bufferedHash, bufferedData);
    }
})();