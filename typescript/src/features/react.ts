import { z } from "zod";
import { ChatCompletion, TextCompletion } from "../apis/openai/api.js";
import { CHAT_COMPLETION_MESSAGE } from "../apis/openai/api.js";
import {
  Dialogue,
  DialogueMessage,
  Socrates,
  Phaedrus,
} from "./prompts-and-completions.js";
import { local } from "../utils/chalk.js";
import { readFile } from "fs/promises";
import { Diagnostic } from "@elastic/elasticsearch";

type ChatCompletionMessage = z.infer<typeof CHAT_COMPLETION_MESSAGE>;

// TODO
const ACTION_LINE = z.string();

export class ReActTrajectory {
  constructor(public messages: ChatCompletionMessage[]) {}

  public async increment(message: ChatCompletionMessage) {
    this.messages.push(message);
    const response = await ChatCompletion.read.one.forPrompt({
      prompt: this.messages,
      model: "gpt-3.5-turbo",
      maxTokens: 1000,
      stop: ["Action[takeAnAction]"],
    });
    this.messages.push({
      role: "assistant",
      content: ChatCompletion.util.getFirstChoiceContent({ from: response }),
    });
  }

  public async run() {
    const response = await ChatCompletion.read.one.forPrompt({
      prompt: this.messages,
      model: "gpt-3.5-turbo",
      maxTokens: 1000,
      stop: ["Action[takeAnAction]"],
    });
    this.messages.push({
      role: "assistant",
      content: ChatCompletion.util.getFirstChoiceContent({ from: response }),
    });
  }
}

const MAX_LOOPS = 1;
export const askReAct = async ({ question }: { question: string }) => {
  const dialogue: DialogueMessage[] = [{ role: "PHAEDRUS", content: question }];
  for (let i = 0; i < MAX_LOOPS; i++) {
    local.green("Socrates thinking...");
    const socratesResponse = await ChatCompletion.read.one.forPrompt({
      prompt: Socrates.breadth({ fromDialogue: dialogue }),
      model: "gpt-4",
      maxTokens: 250,
    });
    const questions = Socrates.completion.parse(
      ChatCompletion.util.getFirstChoiceContent({ from: socratesResponse })
    );
    local.green("Socrates done thinking...");

    const branches = await Promise.all(
      questions.map(async (question) => {
        const branch: DialogueMessage[] = [
          ...dialogue,
          { role: "SOCRATES", content: question },
        ];
        local.red("Phaedrus thinking...");
        const phaedrusResponse = await ChatCompletion.read.one.forPrompt({
          prompt: Phaedrus.createPrompt({ fromDialogue: branch }),
          model: "gpt-4",
          maxTokens: 1000,
        });
        branch.push({
          role: "PHAEDRUS",
          content: ChatCompletion.util.getFirstChoiceContent({
            from: phaedrusResponse,
          }),
        });
        local.red("Phaedrus done thinking...");
        return branch;
      })
    );

    await Promise.all(
      branches.map(async (branch) => {
        local.green("Socrates thinking...");
        const socratesResponse = await ChatCompletion.read.one.forPrompt({
          prompt: Socrates.depth({ fromDialogue: branch }),
          model: "gpt-4",
          maxTokens: 250,
        });
        branch.push({
          role: "SOCRATES",
          content: ChatCompletion.util.getFirstChoiceContent({
            from: socratesResponse,
          }),
        });
        local.green("Socrates done thinking...");
      })
    );

    for (const branch of branches) {
      Dialogue.pTranscript({ fromDialogue: branch });
      local.yellow("-----------------------------------------------------");
    }

    // const protogorasPrompt = Protagoras.createPrompt({
    //   fromDialogue: dialogue,
    // });
    // const protagorasResponse = await TextCompletion.read.one.forPrompt({
    //   prompt: protogorasPrompt,
    //   model: "text-davinci-003",
    //   maxTokens: 400,
    // });
    // local.yellow(
    //   TextCompletion.util.getCompletedText({
    //     fromPrompt: protogorasPrompt,
    //     withResponse: protagorasResponse,
    //   })
    // );
  }
};
