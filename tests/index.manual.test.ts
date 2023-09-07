import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { webSockets } from "@libp2p/websockets";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identifyService } from "libp2p/identify";

import Provider from "../src/Provider.js"
import * as Y from 'yjs'
import { circuitRelayTransport } from "libp2p/circuit-relay";
import { multiaddr } from "@multiformats/multiaddr";

const createPeer = async () => {
    const node = await createLibp2p({
        transports: [webSockets(), circuitRelayTransport({ discoverRelays: 2 })],
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

function insertToEnd(yText: Y.Text, content: string) {
    yText.insert(yText.length, content);
}

const main = async () => {
    const ydoc1 = new Y.Doc()
    const ydoc2 = new Y.Doc()
    const node1 = await createPeer()
    const node2 = await createPeer()
    console.log(`Node 1: ${node1.peerId.toString()}`)
    console.log(`Node 2: ${node2.peerId.toString()}`)
    await node1.dial(multiaddr("/ip4/127.0.0.1/tcp/56000/ws/p2p/12D3KooWSRkaW3kEk5n6rhwedNsDMPfuSrWLx8JL93WSFQh8v8Gf"))
    const provider1 = new Provider(ydoc1, node1 as any, 'test')
    node1.addEventListener("self:peer:update", async () => {
        if (node1.getMultiaddrs()[0]) {
            const provider2 = new Provider(ydoc2, node2 as any, 'test')
            await node2.dial(node1.getMultiaddrs()[0])
            ydoc1.getText("testDoc").insert(0, "Hello")

            setInterval(() => {
                console.log(provider1.awareness.getStates())
            }, 3000)


            // Wait for the state to be synced
            setInterval(() => {
                insertToEnd(ydoc2.getText("testDoc"), "Hi");
                const str = printStates({ ydoc1, ydoc2 });
                console.log(`\n---Doc States---`);
                for (let doc of str) {
                    console.log(`${doc.key} | ${doc.data}`);
                }
                if (str[0].data !== str[1].data) {
                    console.log(`Not synced...`);
                } else {
                    console.log(`Synced...`);
                }
            }, 3000);
        }
    })
}

main()
