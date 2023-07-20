import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { webSockets } from "@libp2p/websockets";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identifyService } from "libp2p/identify";

import Provider from "./index.js"
import { Doc as YDoc, } from 'yjs'
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

const waitFor = async (condition: () => boolean, timeout: number = 3000) => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('timeout')
    }
    // @ts-ignore
    await new Promise(r => setTimeout(r, 50))
  }
}

const printStates = (docs: { [key: string]: YDoc }) => {
  let str = ""
  for (const key in docs) {
    str += `
  ${key} | ${docs[key].getText("testDoc").toString()}`
  }
  console.log("--- Doc States ---" + str)
}

const main = async () => {
  const ydoc1 = new YDoc()
  const ydoc2 = new YDoc()
  const node1 = await createPeer()
  const node2 = await createPeer()
  const provider1 = new Provider(ydoc1, node1, 'test')
  const provider2 = new Provider(ydoc2, node2, 'test')
  await node1.dial(node2.getMultiaddrs()[0])
  ydoc1.getText("testDoc").insert(0, "Hello")
  ydoc2.getText("testDoc").insert(0, "Hi")

  // Wait for the state to be synced
  try {
    await waitFor(() => Uint8ArrayEquals(Y.encodeStateVector(ydoc1), Y.encodeStateVector(ydoc2)))
  } catch (e) {
    printStates({ ydoc1, ydoc2 })
    throw e
  }
}



// it.only('Provider syncs doc across 2 peers', async () => {
//   const topic = 'test'
//   const ydoc1 = new YDoc()
//   const ydoc2 = new YDoc()

//   const node1: Libp2p = await createPeer()
//   const node2: Libp2p = await createPeer()

//   const provider1 = new Provider(ydoc1, node1, topic)
//   const provider2 = new Provider(ydoc2, node2, topic)

//   await connectNodes([node1, node2])

//   ydoc1.getText("testDoc").insert(0, "Hello")

//   // Wait for the state to be synced
//   try {
//     await waitFor(() => Uint8ArrayEquals(Y.encodeStateVector(ydoc1), Y.encodeStateVector(ydoc2)))
//   } catch (e) {
//     printStates({ ydoc1, ydoc2 })
//     throw e
//   }


//   expect(Y.encodeStateVector(ydoc1)).toEqual(Y.encodeStateVector(ydoc2))
//   expect(ydoc1.getText("testDoc").toString()).toEqual(ydoc2.getText("testDoc").toString())


//   await node1.stop()
//   await node2.stop()
//   printStates({ ydoc1, ydoc2 })
// });

// it('Provider syncs doc across 2 unsynced peers', async () => {
//   const topic = 'test'
//   const ydoc1 = new YDoc()
//   ydoc1.getText("testDoc").insert(0, "Hola")
//   const ydoc2 = new YDoc()
//   ydoc2.getText("testDoc").insert(0, "Good bye")

//   const node1: Libp2p = await createPeer()
//   const node2: Libp2p = await createPeer()

//   const provider1 = new Provider(ydoc1, node1, topic)
//   const provider2 = new Provider(ydoc2, node2, topic)

//   await connectNodes([node1, node2])
//   ydoc1.getText("testDoc").insert(0, "Hello")

//   // Wait for the state to be synced
//   try {
//     await waitFor(() => Uint8ArrayEquals(Y.encodeStateVector(ydoc1), Y.encodeStateVector(ydoc2)))
//   } catch (e) {
//     printStates({ ydoc1, ydoc2 })
//     throw e
//   }


//   expect(Y.encodeStateVector(ydoc1)).toEqual(Y.encodeStateVector(ydoc2))
//   expect(ydoc1.getText("testDoc").toString()).toEqual(ydoc2.getText("testDoc").toString())


//   await node1.stop()
//   await node2.stop()
//   printStates({ ydoc1, ydoc2 })
// });

// function printStates(docs: { [key: string]: YDoc }) {
//   let str = ""
//   for (const key in docs) {
//     str += `
//   ${key} | ${docs[key].getText("testDoc").toString()}`
//   }
//   console.log("--- Doc States ---" + str)
// }

// async function connectNodes(nodes: Libp2p[]) {
//   const firstNode = nodes[0]
//   for (let i = 1; i < nodes.length; i++) {
//     const node = nodes[i]
//     await firstNode.dial(node.multiaddrs[0] + '/p2p/' + node.peerId.toB58String())
//     await firstNode.ping(node.peerId)
//     await node.ping(firstNode.peerId)
//   }

//   for (let i = 0; i < nodes.length; i++) {
//     for (let j = 0; j < nodes.length; j++) {
//       if (i === j) continue
//       const node = nodes[i]
//       const otherNode = nodes[j]
//       node.peerStore.addressBook.set(otherNode.peerId, otherNode.multiaddrs)
//     }
//   }
// }

// it('Provider syncs awareness across 2 peers', async () => {
//   const topic = 'test'
//   const ydoc1 = new YDoc()
//   const ydoc2 = new YDoc()

//   const node1: Libp2p = await createPeer()
//   const node2: Libp2p = await createPeer()

//   const provider1 = new Provider(ydoc1, node1, topic)
//   const provider2 = new Provider(ydoc2, node2, topic)

//   await connectNodes([node1, node2])

//   ydoc1.getText("testDoc").insert(0, "Hello")
//   ydoc2.getText("testDoc").insert(0, "Hi")

//   // Wait for the state to be synced
//   try {
//     await waitFor(() => Uint8ArrayEquals(Y.encodeStateVector(ydoc1), Y.encodeStateVector(ydoc2)))
//   } catch (e) {
//     printStates({ ydoc1, ydoc2 })
//     throw e
//   }


//   expect(Y.encodeStateVector(ydoc1)).toEqual(Y.encodeStateVector(ydoc2))
//   expect(provider1.awareness.getStates()).toEqual(provider2.awareness.getStates())


//   await node1.stop()
//   await node2.stop()
//   printStates({ ydoc1, ydoc2 })
// });
