import { createLibp2p, Libp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { webSockets } from "@libp2p/websockets";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identifyService } from "libp2p/identify";

export const createPeer = async (): Promise<Libp2p> => {
    const node: Libp2p = await createLibp2p({
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
