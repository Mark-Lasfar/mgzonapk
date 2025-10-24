// app/api/socket/route.ts
import { Server } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/db';
import Message from '@/lib/db/models/message.model';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(res.socket as any).server.io) {
    const io = new Server((res.socket as any).server);
    (res.socket as any).server.io = io;

    io.on('connection', (socket) => {
      socket.on('join', (storeId: string) => {
        socket.join(storeId);
      });

      socket.on('send-message', async ({ storeId, senderName, senderEmail, message }) => {
        await connectToDatabase();
        const newMessage = await Message.create({
          storeId,
          senderName,
          senderEmail,
          message,
          status: 'pending',
        });
        io.to(storeId).emit('new-message', newMessage);
      });

      socket.on('send-reply', async ({ storeId, messageId, reply }) => {
        await connectToDatabase();
        const message = await Message.findOne({ _id: messageId, storeId });
        if (message) {
          message.reply = reply;
          message.status = 'replied';
          await message.save();
          io.to(storeId).emit('message-updated', message);
        }
      });
    });
  }
  res.end();
}