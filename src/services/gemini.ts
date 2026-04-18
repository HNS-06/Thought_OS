import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const geminiService = {
  async getThoughtInsights(thought: string) {
    if (!apiKey) {
      return [
        "Potential link: Neural network expansion",
        "Correlation: Data density increase"
      ];
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Given the thought "${thought}", provide 2-3 brief, cryptic, technical-sounding insights for a neural map application. Keep them under 10 words each. Format: JSON array of strings.`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (text) {
        return JSON.parse(text);
      }
    } catch (error) {
      console.error("Gemini error:", error);
    }

    return [
      "Potential link: Synaptic bypass",
      "Correlation: Cognitive load balance"
    ];
  }
};
