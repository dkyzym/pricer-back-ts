import { Server as SocketIOServer } from 'socket.io';
import type { LogEntry, LoggerOptions } from 'winston';
import Transport from 'winston-transport';

/** Настраиваемый класс-транспорт для отправки логов в socket.io */
export class SocketIOTransport extends Transport {
  private io: SocketIOServer;

  constructor(opts: { io: SocketIOServer } & LoggerOptions) {
    super(opts);
    this.io = opts.io;
  }

  // Основной метод, вызывается на каждый лог
  log(info: LogEntry, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    const payload = {
      level: info.level,
      message: typeof info.message === 'string' ? info.message : String(info.message),
      timestamp: (info as any).timestamp ?? new Date().toISOString(),
      stack: (info as any).stack ?? undefined,
      user: (info as any).user ?? undefined,
    };
    this.io.to('admin').emit('logMessage', payload);

    callback();
  }
}
