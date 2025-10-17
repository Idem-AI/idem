import { Response } from "express";
import { CustomRequest } from "../interfaces/express.interface";
import { PromptRequest, PromptService } from "../services/prompt.service";

class PromptController {
  constructor(private readonly promptService: PromptService) {}
  async handlePromptRequest(req: CustomRequest, res: Response): Promise<void> {
    try {
      const requestBody: PromptRequest = req.body;

      if (!requestBody.messages || requestBody.messages.length === 0) {
        res.status(400).json({
          error:
            "Missing required fields: provider, modelName, or non-empty messages array",
        });
        return;
      }
      const messages = requestBody.messages;
      const config = requestBody;

      // Pass the runPrompt function from the service to tryGenerateFullJSON
      const jsonResponse = await this.promptService.runPrompt(config, messages);
      res.status(200).json(jsonResponse);
    } catch (error: any) {
      console.error("Error in PromptController:", error);
      // Check if the error has a message property, otherwise send a generic error
      const errorMessage =
        error.message || "Something broke during prompt processing!";
      res.status(500).send({ error: errorMessage });
    }
  }
}

export const promptController = new PromptController(new PromptService());
