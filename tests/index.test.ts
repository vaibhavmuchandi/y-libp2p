import Provider from "../src/Provider.js"
import { Doc as YDoc, } from 'yjs'
import { Uint8ArrayEquals } from "../src/utils.js"
import * as Y from 'yjs'
import { Libp2p } from "libp2p"
import { createPeer } from './test-utils/createPeer.js'
import { expect } from 'chai';

async function waitFor(condition: () => boolean, timeout: number = 10000) {
    const start = Date.now()
    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error('timeout')
        }
        await new Promise(r => setTimeout(r, 50))
    }
}

function printStates(docs: { [key: string]: YDoc }) {
    let str = ""
    for (const key in docs) {
        str += `
  ${key} | ${docs[key].getText("testDoc").toString()}`
    }
    console.log("--- Doc States ---" + str)
}

async function connectNodes(nodes: Libp2p[]) {
    const firstNode = nodes[0]
    const secondNode = nodes[1]
    await firstNode.dial(secondNode.getMultiaddrs()[0])
}

function uint8ArraysAreEqual(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    return a.every((val, index) => val === b[index]);
}



describe('Libp2p YJS Provider Tests', () => {
    it('Provider syncs doc across 2 peers', async () => {
        const topic = 'test'
        const ydoc1 = new YDoc()
        const ydoc2 = new YDoc()

        const node1: Libp2p = await createPeer()
        const node2: Libp2p = await createPeer()

        const provider1 = new Provider(ydoc1, node1 as any, topic)
        const provider2 = new Provider(ydoc2, node2 as any, topic)

        await connectNodes([node1, node2])

        ydoc1.getText("testDoc").insert(0, "Hello")

        try {
            await waitFor(() => Uint8ArrayEquals(Y.encodeStateVector(ydoc1), Y.encodeStateVector(ydoc2)))
        } catch (e) {
            printStates({ ydoc1, ydoc2 })
            throw e
        }

        expect(Y.encodeStateVector(ydoc1)).to.deep.equal(Y.encodeStateVector(ydoc2))
        expect(ydoc1.getText("testDoc").toString()).to.equal(ydoc2.getText("testDoc").toString())


        await node1.stop()
        await node2.stop()
        printStates({ ydoc1, ydoc2 })
    });

    it('Provider syncs doc across 2 unsynced peers', async () => {
        const topic = 'test'
        const ydoc1 = new YDoc()
        ydoc1.getText("testDoc").insert(0, "Hola")
        const ydoc2 = new YDoc()
        ydoc2.getText("testDoc").insert(0, "Good bye")

        const node1: Libp2p = await createPeer()
        const node2: Libp2p = await createPeer()

        const provider1 = new Provider(ydoc1, node1 as any, topic)
        const provider2 = new Provider(ydoc2, node2 as any, topic)

        await connectNodes([node1, node2])
        ydoc1.getText("testDoc").insert(0, "Hello")

        try {
            await waitFor(() => Uint8ArrayEquals(Y.encodeStateVector(ydoc1), Y.encodeStateVector(ydoc2)))
        } catch (e) {
            printStates({ ydoc1, ydoc2 })
            throw e
        }

        expect(Y.encodeStateVector(ydoc1)).to.deep.equal(Y.encodeStateVector(ydoc2))
        expect(ydoc1.getText("testDoc").toString()).to.equal(ydoc2.getText("testDoc").toString())


        await node1.stop()
        await node2.stop()
        printStates({ ydoc1, ydoc2 })
    });

    it('Provider syncs awareness across 2 peers', async function () {
        this.timeout(10000);

        const topic = 'test';
        const ydoc1 = new Y.Doc();
        const ydoc2 = new Y.Doc();

        const node1: Libp2p = await createPeer();
        const node2: Libp2p = await createPeer();

        const provider1 = new Provider(ydoc1, node1 as any, topic);
        const provider2 = new Provider(ydoc2, node2 as any, topic);

        await connectNodes([node1, node2]);

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        await delay(2000);
        ydoc2.getText("testDoc").insert(0, "Hi");

        await delay(2000);
        ydoc1.getText("testDoc").insert(0, "Hello");

        await delay(3000);

        expect(Y.encodeStateVector(ydoc1)).to.deep.equal(Y.encodeStateVector(ydoc2));
        expect(provider1.awareness.getStates()).to.deep.equal(provider2.awareness.getStates());

        await node1.stop();
        await node2.stop();
        printStates({ ydoc1, ydoc2 })
    });

});
