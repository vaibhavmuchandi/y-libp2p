import { Libp2p } from 'libp2p'
import type { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { Uint8ArrayEquals } from './utils.js'
import { peerIdFromString } from '@libp2p/peer-id'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import EventEmitter from 'eventemitter3'
import { createPeer } from './utils.js'
import { multiaddr } from '@multiformats/multiaddr'

type ProtocolStream = {
    sink: (data: Iterable<any> | AsyncIterable<any>) => Promise<void>
    source: AsyncIterable<any>
    close: () => void
}


function changesTopic(topic: string): string {
    return `/drawp2p/y/${topic}/changes/0.0.1`
}

function stateVectorTopic(topic: string): string {
    return `/drawp2p/y/${topic}/stateVector/0.0.1`
}

function syncProtocol(topic: string): string {
    return `/drawp2p/y/${topic}/sync/0.0.1`
}

function awarenessProtocolTopic(topic: string): string {
    return `/drawp2p/y/${topic}/awareness/0.0.1`
}

class Provider {
    ydoc: Y.Doc;
    node: Libp2p;
    peerID: string;
    topic: string
    stateVectors: { [key: string]: Uint8Array } = {};
    unsyncedPeers: Set<string> = new Set();
    initialSync = false;
    private events: EventEmitter;

    public awareness: Awareness;

    aggressivelyKeepPeersUpdated: boolean = true;

    constructor(ydoc: Y.Doc, node: Libp2p, topic: string) {
        this.ydoc = ydoc;
        this.node = node;
        this.topic = topic;
        this.peerID = node.peerId.toString()
        this.stateVectors[this.peerID] = Y.encodeStateVector(this.ydoc)
        this.awareness = new awarenessProtocol.Awareness(ydoc)
        this.events = new EventEmitter();

        this.awareness.setLocalStateField("user", {
            name: this.peerID
        })

        this.node.addEventListener("peer:connect", (_evt) => {
            console.log(`Connected to ${_evt.detail.toString()}`)
        })

        setTimeout(() => {
            this.emit('status', { status: 'connected' });
        }, 5000)

        ydoc.on('update', this.onUpdate.bind(this));

        (this.node.services.pubsub as any).subscribe(changesTopic(topic));
        (this.node.services.pubsub as any).subscribe(stateVectorTopic(topic));
        (this.node.services.pubsub as any).subscribe(awarenessProtocolTopic(topic));
        (this.node.services.pubsub as any).addEventListener("message", (_evt) => {
            if (_evt.detail.topic == changesTopic(topic)) {
                console.log("changes msg")
                this.onPubSubChanges(_evt)
            } else if (_evt.detail.topic == stateVectorTopic(topic)) {
                console.log('topic msg')
                this.onPubSubStateVector(_evt)
            } else if (_evt.detail.topic == awarenessProtocolTopic(topic)) {
                console.log('awareness msg')
                this.onPubSubAwareness(_evt);
            } else {
                console.log("Unknow subscription msg", _evt.detail.topic)
            }
        });

        try {
            node.handle(syncProtocol(topic), this.onSyncMsg.bind(this), { runOnTransientConnection: true });
        } catch (e) {
            console.log('handler registerd', e)
        }
        setTimeout(() => {
            this.tryInitialSync(this.stateVectors[this.peerID], this);
        }, 3000)
    }

    on(event: string, listener: (...args: any[]) => void) {
        this.events.on(event, listener);
    }

    off(event: string, listener: (...args: any[]) => void) {
        this.events.off(event, listener);
    }

    emit(event: string, ...args: any[]) {
        this.events.emit(event, ...args);
    }

    destroy() {
        (this.node.services.pubsub as any).unsubscribe(changesTopic(this.topic));

        (this.node.services.pubsub as any).unsubscribe(stateVectorTopic(this.topic));

        (this.node.services.pubsub as any).unsubscribe(awarenessProtocolTopic(this.topic));

        this.node.unhandle(syncProtocol(this.topic));

        this.initialSync = true;
    }

    static init = async (roomId: string) => {
        const doc = new Y.Doc()
        const node = await createPeer()
        await node.dial(multiaddr("/ip4/127.0.0.1/tcp/56000/ws/p2p/12D3KooWSRkaW3kEk5n6rhwedNsDMPfuSrWLx8JL93WSFQh8v8Gf"))
        const provider = new Provider(doc, node, roomId)
        return provider
    }

    private async tryInitialSync(updateData: Uint8Array, origin: this | any) {
        const tries = 10;
        const maxWaitTime = 1000;
        let waitTime = 100;
        for (let i = 0; i < tries; i++) {
            if (this.initialSync) {
                return
            }
            const peers = [...(this.node.services.pubsub as any).topics.get(stateVectorTopic(this.topic)) || []]

            if (peers.length !== 0) {
                const peer = peers[i % peers.length]
                try {
                    await this.syncPeer(peer)
                    this.initialSync = true;
                    return true
                } catch (e) {
                    console.warn("failed to sync with anyone", e)
                }
            }

            await new Promise(resolve => setTimeout(resolve, waitTime))
            waitTime = Math.min(waitTime * 2, maxWaitTime)
        }
    }

    private onUpdate(updateData: Uint8Array, origin: this | any) {
        if (origin !== this) {
            this.publishUpdate(updateData);
            return
        }
    }

    private publishUpdate(updateData: Uint8Array) {
        if (!this.node.isStarted()) {
            return
        }

        (this.node.services.pubsub as any).publish(changesTopic(this.topic), updateData);
        const stateV = Y.encodeStateVector(this.ydoc)
        this.stateVectors[this.peerID] = stateV;
        (this.node.services.pubsub as any).publish(stateVectorTopic(this.topic), stateV);
        const data = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.ydoc.clientID]);
        (this.node.services.pubsub as any).publish(awarenessProtocolTopic(this.topic), awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.ydoc.clientID]))
    }

    private onPubSubChanges(msg: any) {
        this.updateYdoc(msg.detail.data, this);
    }

    private onPubSubStateVector(msg: any) {
        this.stateVectors[msg.detail.from] = msg.detail.data;

        if (!Uint8ArrayEquals(msg.detail.data, this.stateVectors[this.peerID])) {
            this.queuePeerSync(msg.detail.from.toString());
        }
    }

    private onPubSubAwareness(msg: any) {
        try {
            awarenessProtocol.applyAwarenessUpdate(this.awareness, msg.detail.data, this)
        } catch (e) {
            console.log(e)
        }

    }

    private updateYdoc(updateData: Uint8Array, origin: any) {
        this.initialSync = true;
        Y.applyUpdate(this.ydoc, updateData, this);
        this.stateVectors[this.peerID] = Y.encodeStateVector(this.ydoc)
    }

    storeStateVector(peerID: string, stateVector: Uint8Array) {
        this.stateVectors[peerID] = stateVector;
    }

    fetchStateVector(peerID: string) {
        return this.stateVectors[peerID];
    }

    private async runSyncProtocol(stream: ProtocolStream, remotePeer: string, initiate: boolean) {
        if (initiate) {
            await stream.sink([
                this.stateVectors[this.peerID],
                Y.encodeStateAsUpdate(this.ydoc, this.stateVectors[remotePeer])
            ])
        }

        const [{ value: stateVector }, { value: updateData }] = [
            await stream.source[Symbol.asyncIterator]().next(),
            await stream.source[Symbol.asyncIterator]().next()
        ]
        this.stateVectors[remotePeer] = stateVector.slice(0);
        this.updateYdoc(updateData.slice(0), this);

        if (!initiate) {
            await stream.sink([
                Y.encodeStateVector(this.ydoc),
                Y.encodeStateAsUpdate(this.ydoc, this.stateVectors[remotePeer])
            ])
        }

        stream.close()
    }

    private async onSyncMsg({ stream, connection, ...rest }: { stream: ProtocolStream, connection: any }) {
        await this.runSyncProtocol(stream, connection.remotePeer.toString(), false)
    }

    private queuePeerSync(peerID: string) {
        this.unsyncedPeers.add(peerID);
        if (this.aggressivelyKeepPeersUpdated) {
            for (const peerID of this.unsyncedPeers) {
                this.syncPeer(peerID).catch(console.error);
            }
        } else {
            throw new Error("Not implemented")
        }
    }

    private async syncPeer(peerID: string) {
        if (!peerID) return
        const peer = await this.node.peerStore.get(peerIdFromString(peerID));
        let success = false;
        if (!peer) {
            return
        }
        for (const ma of peer.addresses) {
            const maStr = ma.multiaddr
            try {
                const stream = await this.node.dialProtocol(maStr, syncProtocol(this.topic))
                await this.runSyncProtocol(stream, peerID, true)
                success = true;
                return
            } catch (e) {
                console.warn(`Failed to sync with ${maStr}`, e)
                continue;
            }
        }
        throw new Error("Failed to sync with peer")
    }
}

export default Provider