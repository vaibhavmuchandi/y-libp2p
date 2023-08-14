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

const main = async () => {
  const ydoc1 = new Y.Doc()
  const ydoc2 = new Y.Doc()
  const node1 = await createPeer()
  const node2 = await createPeer()
  console.log(`Node 1: ${node1.peerId.toString()}`)
  console.log(`Node 2: ${node2.peerId.toString()}`)
  const provider1 = new Provider(ydoc1, node1, 'test')
  const provider2 = new Provider(ydoc2, node2, 'test')
  await node1.dial(node2.getMultiaddrs()[0])
  ydoc1.getText("testDoc").insert(0, "Hello")
  ydoc2.getText("testDoc").insert(0, "Hi")

  // Wait for the state to be synced
  setInterval(() => {
    const str = printStates({ ydoc1, ydoc2 })
    console.log(`\n---Doc States---`)
    for (let doc of str) {
      console.log(`${doc.key} | ${doc.data}`)
    }
    if (str[0].data != str[1].data) {
      console.log(`Not synced...`)
    } else {
      console.log(`Synced...`)
      process.exit(0)
    }
  }, 3000)
}

main()
