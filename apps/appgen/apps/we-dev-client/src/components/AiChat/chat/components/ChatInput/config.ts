import DeepSeekIcon from "@/icon/Deepseek"
import OpenaiIcon from "@/icon/Openai"
import ClaudeIcon from "@/icon/Claude"
import OllamaIcon from "@/icon/Ollama"
import GeminiIcon from "@/icon/Gemini"

export const aiProvierIcon = {
    "openai": OpenaiIcon,
    "deepseek": DeepSeekIcon,
    "claude": ClaudeIcon,
    "ollama": OllamaIcon,
    "claude37": ClaudeIcon,
    "gemini": GeminiIcon,
    // Pas d'icône propre à GLM pour l'instant : on réutilise celle d'OpenAI,
    // son API étant celle qu'il expose.
    "glm": OpenaiIcon
}
