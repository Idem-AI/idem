import { FileAction, StreamingMessageParser } from './messae';

import { createFileWithContent } from '../WeIde/components/IDEContent/FileExplorer/utils/fileSystem';
import { isScaffoldLocked, looksDegenerate } from '@/utils/scaffoldLock';
import useTerminalStore from '@/stores/terminalSlice';
import { Message } from 'ai/react';
import { runFast } from '../WeIde/services/webcontainer/fastCommands';

class Queue {
  private queue: string[] = [];
  private processing: boolean = false;

  // 添加命令到队列
  push(command: string) {
    this.queue.push(command);
    this.process();
  }

  // 获取队列中的下一个命令
  private getNext(): string | undefined {
    return this.queue.shift();
  }

  // 处理队列
  private async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const next = this.getNext();
        if (!next) continue;

        // Le chemin rapide d'abord : dépendances depuis le cache ou l'instantané, serveur déjà lancé gardé.
        // Seul ce qui n'est pas reconnu va au terminal (voir `fastCommands`).
        const command = await runFast(next);
        if (!command) {
          console.log('[exec] fait par le chemin rapide :', next);
          continue;
        }

        console.log('[exec]', command);

        // Un terminal peut manquer (atelier encore en train de monter) ou
        // disparaître en cours de route. Avant, la promesse rejetée arrêtait la
        // file entière et les commandes suivantes — dont `npm run dev` — ne
        // partaient jamais, pour un aperçu qui restait vide sans explication.
        try {
          const terminal = useTerminalStore.getState().getTerminal(0);
          if (!terminal) {
            console.warn('[exec] aucun terminal, commande ignorée :', command);
            continue;
          }
          await terminal.executeCommand(command);
        } catch (error) {
          console.warn('[exec] échec de', command, error);
        }
      }
    } finally {
      this.processing = false;
    }
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
        console.log('[exec]', command);
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
      const { filePath, content } = data.action as FileAction;

      // Le socle préconfiguré est posé par le code et verrouillé : une
      // réécriture par le modèle ne peut rien améliorer et peut tout casser
      // (palette amputée, script d'amorçage oublié). On la laisse tomber.
      if (isScaffoldLocked(filePath)) {
        return;
      }

      // Le modèle se répète parfois jusqu'à produire un fichier illisible. On
      // ne remplace pas du travail valable par une boucle.
      if (looksDegenerate(content)) {
        return;
      }

      createFileWithContent(filePath, content, true);
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
