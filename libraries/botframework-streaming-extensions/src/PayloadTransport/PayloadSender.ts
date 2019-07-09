/**
 * @module botframework-streaming-extensions
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { Header } from '../Models/Header';
import { HeaderSerializer } from '../Payloads/HeaderSerializer';
import { Stream } from '../Stream';
import { ITransportSender } from '../Transport/ITransportSender';
import { TransportContants } from '../Transport/TransportConstants';
import { IPayloadSender } from './IPayloadSender';
import { SendPacket } from './SendPacket';
import { TransportDisconnectedEventArgs } from './TransportDisconnectedEventArgs';
import { TransportDisconnectedEventHandler } from './TransportDisconnectedEventHandler';

export class PayloadSender implements IPayloadSender {
  public disconnected?: TransportDisconnectedEventHandler;
  private sender: ITransportSender;
  private readonly sendHeaderBuffer: Buffer = Buffer.alloc(TransportContants.MaxHeaderLength);

  public get isConnected(): boolean {
    return this.sender !== undefined;
  }

  public connect(sender: ITransportSender) {
    this.sender = sender;
  }

  public sendPayload(header: Header, payload: Stream, sentCallback: () => Promise<void>): void {
    this.writePacket(new SendPacket(header, payload, sentCallback));
  }

  public disconnect(e: TransportDisconnectedEventArgs) {
    if (this.isConnected) {
      this.sender.close();
      this.sender = undefined;

      if (this.disconnected) {
        this.disconnected(this, e || TransportDisconnectedEventArgs.Empty);
      }
    }
  }

  private writePacket(packet: SendPacket): void {
    try {
      HeaderSerializer.serialize(packet.header, this.sendHeaderBuffer);
      this.sender.send(this.sendHeaderBuffer);

      if (packet.header.PayloadLength > 0 && packet.payload) {
        let count = packet.header.PayloadLength;
        while (count > 0) {
          // TODO: Min(count, a max chunk size)
          let chunk = packet.payload.read(count);
          this.sender.send(chunk);
          count -= chunk.length;
        }

        if (packet.sentCallback) {
          // tslint:disable-next-line: no-floating-promises
          packet.sentCallback();
        }
      }
    } catch (e) {
      this.disconnect(new TransportDisconnectedEventArgs(e.message));
    }
  }
}