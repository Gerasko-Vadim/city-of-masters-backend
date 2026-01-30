import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  afterInit(server: Server) {
    console.log('WebSocket initialized');
  }

  handleConnection(client: any, ...args: any[]) {
    // console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    // console.log(`Client disconnected: ${client.id}`);
  }

  sendOrderUpdate(order: any) {
    this.server.emit('orderUpdate', order);
  }

  sendSpecialistUpdate(specialist: any) {
    this.server.emit('specialistUpdate', specialist);
  }
}
