import { expect } from 'chai';
import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { webSockets } from "@libp2p/websockets";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identifyService } from "libp2p/identify";

import Provider from "./index.js"
import { Uint8ArrayEquals } from "./util.js"
import * as Y from 'yjs'

const createPeer = async () => {
    const node = await createLibp2p({
        addresses: {
            listen: [`/ip4/0.0.0.0/tcp/0/ws`],
        },
        transports: [webSockets()],
        connectionEncryption: [noise()],
        streamMuxers: [yamux(), mplex()],
        services: {
            pubsub: gossipsub({ allowPublishToZeroPeers: true }),
            identify: identifyService(),
        },
    });
    return node;
};

const printStates = (docs: { [key: string]: Y.Doc }) => {
    let array = []

    for (const key in docs) {
        const data = {
            key: key,
            data: docs[key].getText("testDoc").toString()
        }
        array.push(data)
    }
    return array
}

describe('YJS Libp2p Integration', () => {
    let node1, node2, ydoc1, ydoc2;

    beforeEach(async () => {
        ydoc1 = new Y.Doc();
        ydoc2 = new Y.Doc();
        node1 = await createPeer();
        node2 = await createPeer();
    });

    it('should sync ydoc states', async function () {
        this.timeout(10000); // Set a longer timeout if necessary

        const provider1 = new Provider(ydoc1, node1, 'test');
        const provider2 = new Provider(ydoc2, node2, 'test');
        await node1.dial(node2.getMultiaddrs()[0]);

        ydoc1.getText("testDoc").insert(0, "Hello");
        ydoc2.getText("testDoc").insert(0, "Hi");

        // A crude way to wait for potential sync, ideally you should use event-driven checks
        await new Promise(resolve => setTimeout(resolve, 5000));

        const states = printStates({ ydoc1, ydoc2 });

        expect(states[0].data).to.equal(states[1].data);
    });
});
