import type { Server as SocketIOServer } from 'socket.io';

/** Синглтон экземпляра Socket.IO для emit из HTTP-слоя (корзина, логи). */
let socketIo: SocketIOServer | null = null;

export const setSocketIo = (io: SocketIOServer): void => {
  socketIo = io;
};

export const getSocketIo = (): SocketIOServer | null => socketIo;
