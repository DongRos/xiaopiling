import { GoogleGenAI, Type } from "@google/genai";

export interface JudgeResult {
  hisFault: number;
  herFault: number;
  analysis: string;
  advice: string;
  prevention: string;
}

export const judgeConflict = async (
  reason: string,
  hisPoint: string,
  herPoint: string
): Promise<JudgeResult> => {
  
  const prompt = `
    你是一只名叫“喵喵法官”的猫咪大法官（一只傲娇、可爱、正义感爆棚的小猫）。
    现在你的两位铲屎官（情侣）吵架了，需要你来裁决。
    
    争吵原因: ${reason}
    铲屎官公猫(男方)观点 (A): ${hisPoint}
    铲屎官母猫(女方)观点 (B): ${herPoint}

    请以JSON格式输出裁决结果：
    - hisFault: 整数 0-100 (男铲屎官的过错百分比)
    - herFault: 整数 0-100 (女铲屎官的过错百分比)
    - analysis: 复盘分析，请务必使用猫咪的口吻（例如使用“本喵”、“喵呜”、“愚蠢的铲屎官”）。语气要幽默、可爱但一针见血，指出问题的核心。
    - advice: 和好建议，具体的行动指南，教他们如何哄好对方（比如互相顺毛、买好吃的、抱抱、道歉的方式）。
    - prevention: 预防建议，告诉他们下次遇到类似情况该怎么做，才能避免再次吵架。

    JSON格式示例:
    {
      "hisFault": 60,
      "herFault": 40,
      "analysis": "喵呜！听完你们的陈述，本喵觉得公猫铲屎官有点太粗心了...",
      "advice": "快去给母猫铲屎官买个罐头（或者奶茶）赔罪吧！",
      "prevention": "下次再遇到这种事，先深呼吸三次，或者来撸撸猫冷静一下。"
    }
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hisFault: { type: Type.INTEGER },
            herFault: { type: Type.INTEGER },
            analysis: { type: Type.STRING },
            advice: { type: Type.STRING },
            prevention: { type: Type.STRING },
          },
          required: ["hisFault", "herFault", "analysis", "advice", "prevention"],
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    
    const hisFault = typeof parsed.hisFault === 'number' ? parsed.hisFault : 50;
    const herFault = typeof parsed.herFault === 'number' ? parsed.herFault : (100 - hisFault);
    
    const analysis = parsed.analysis || "喵？本喵刚才睡着了...不过看起来你们都需要冷静一下，给对方顺顺毛吧！";
    const advice = parsed.advice || "别吵啦，本喵命令你们立刻抱抱！";
    const prevention = parsed.prevention || "多给本喵买点罐头，你们的感情就会变好！";

    return {
      hisFault,
      herFault,
      analysis,
      advice,
      prevention
    };
  } catch (error) {
    console.error("AI Judge Error:", error);
    return {
      hisFault: 50,
      herFault: 50,
      analysis: "本喵服务器开小差了，你们自己看着办吧！喵！",
      advice: "别吵了，给本喵开个罐头吧。",
      prevention: "保持冷静，peace and love."
    };
  }
};

export const extractTodosFromText = async (text: string, currentDate: string): Promise<{ text: string; date: string }[]> => {
  const prompt = `
    Role: You are a personal assistant extracting to-do tasks from a chat message.
    Current Context:
    - Current Date (Beijing Time): ${currentDate} (Format: YYYY-MM-DD).
    - The user is in the Beijing Time Zone (GMT+8).

    CRITICAL DATE RULES:
    1. "今晚" (Tonight) MUST correspond to TODAY'S date (${currentDate}). Do NOT set it to tomorrow.
    2. "今天" (Today) = ${currentDate}.
    3. "明天" (Tomorrow) = The day after ${currentDate}.
    4. "后天" = Two days after ${currentDate}.
    5. "周X" (Week X) = The *coming* Week X.
    6. If no date is mentioned, use ${currentDate}.

    Task: Extract actionable tasks.
    Input Text: "${text}"

    Output JSON format: An array of objects, each having "text" (the task content) and "date" (YYYY-MM-DD).
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              date: { type: Type.STRING }
            },
            required: ["text", "date"]
          }
        }
      }
    });

    const textRes = response.text;
    if (!textRes) return [];
    
    const cleanText = textRes.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("AI Todo Extraction Error:", error);
    return [];
  }
};
