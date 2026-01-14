import { FileAction, StreamingMessageParser } from './messae';

import { createFileWithContent } from '../WeIde/components/IDEContent/FileExplorer/utils/fileSystem';
import useTerminalStore from '@/stores/terminalSlice';
import { Message } from 'ai/react';

class Queue {
  private queue: {
    command: string;
    resolve: () => void;
    reject: (reason?: any) => void;
  }[] = [];
  private processing: boolean = false;

  // Add command to queue and return a promise that resolves when executed
  push(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ command, resolve, reject });
      this.process();
    });
  }

  // Get next command object
  private getNext() {
    return this.queue.shift();
  }

  // Process the queue
  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const command = this.getNext();
        if (command) {
          console.log('执行命令', command);
          await useTerminalStore.getState().getTerminal(0).executeCommand(command);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  // Clear the queue
  clear() {
    this.queue = [];
  }
}

export const queue = new Queue();

class List {
  private isRunArray: string[] = [];
  private nowArray: string[] = [];

  // 添加命令到队列
  run(commands: string[]) {
    this.nowArray = commands;
    this.process();
  }

  private getCommand(number: number) {
    return this.nowArray?.[number];
  }

  // 判断命令是否已经执行
  private getIsRun(number: number) {
    return this.isRunArray?.[number];
  }

  // 处理队列
  private async process() {
    console.log('this.nowArray', this.nowArray, this.isRunArray);
    for (let i = 0; i < this.nowArray.length; i++) {
      const command = this.getCommand(i);
      const isRuned = this.getIsRun(i);
      if (command && command !== isRuned) {
        console.log('执行命令', command);
        this.isRunArray[i] = command;
        queue.push(command);
      }
    }
  }

  // 清空队列
  clear() {
    this.nowArray = [];
    this.isRunArray = [];
  }
}

export const execList = new List();

const messageParser = new StreamingMessageParser({
  callbacks: {
    onActionStream: async (data) => {
      createFileWithContent((data.action as FileAction).filePath, data.action.content, true);
      //   workbenchStore.runAction(data, true);
    },
  },
});

export const parseMessages = async (messages: Message[]) => {
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'assistant') {
      messageParser.parse(message.id, message.content);
    }
  }
};
