import { GoogleGenAI } from "@google/genai";

const getClient = () => {
    // NOTE: In a real production app, never expose API keys on the client.
    // This is for demonstration purposes within the specified runtime environment.
    const apiKey = process.env.API_KEY || ''; 
    return new GoogleGenAI({ apiKey });
}

export const generateNFTImage = async (prompt: string): Promise<string | null> => {
    try {
        const ai = getClient();
        // Using flash-image model for AI image generation
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: prompt }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    // imageSize: "1K" -- This is only supported on pro-image-preview models
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData) {
                const base64EncodeString = part.inlineData.data;
                return `data:image/png;base64,${base64EncodeString}`;
             }
        }
        return null;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return null;
    }
};

export const generateCollectionDescription = async (name: string): Promise<string> => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a short, punchy, exciting description (max 20 words) for an NFT collection named "${name}". usage: marketplace UI.`,
        });
        return response.text.trim();
    } catch (error) {
        console.error("AI Text Error:", error);
        return "A unique collection from the depths of the Solana blockchain.";
    }
};
