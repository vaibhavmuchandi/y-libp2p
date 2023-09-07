import { webSockets } from "@libp2p/websockets"
import * as filters from "@libp2p/websockets/filters"
import { mplex } from "@libp2p/mplex"
import { createLibp2p, Libp2p } from "libp2p"
import { circuitRelayTransport } from 'libp2p/circuit-relay'
import { noise } from "@chainsafe/libp2p-noise"
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { identifyService } from 'libp2p/identify'
import { multiaddr } from "@multiformats/multiaddr"
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'

export function Uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

export const createPeer = async (): Promise<Libp2p> => {
    return await createLibp2p({
        transports: [
            webSockets({
                filter: filters.all,
            }),
            circuitRelayTransport({
                discoverRelays: 1,
            }),
        ],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        connectionGater: {
            denyDialMultiaddr: () => {
                return false;
            }
        } as any,
        services: {
            identify: identifyService(),
            pubsub: gossipsub({ allowPublishToZeroPeers: true })
        },
        peerDiscovery: [
            pubsubPeerDiscovery() as any
        ]
    })
}