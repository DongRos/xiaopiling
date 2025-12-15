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
  
  // 1. 在 judgeConflict 函数中：
  const prompt = `
    你是一只名叫“喵喵法官”的猫咪大法官（傲娇、可爱、但非常公正）。
    铲屎官们吵架了，请你裁决！
    
    争吵原因: ${reason}
    一方观点: ${hisPoint}
    另一方观点: ${herPoint}

    请以JSON格式输出裁决结果：
    {
      "hisFault": 整数 0-100 (第一位铲屎官的过错比例),
      "herFault": 整数 0-100 (第二位铲屎官的过错比例),
      "analysis": "【喵喵复盘】请用猫咪口吻（如本喵、喵呜）可爱地分析吵架原因。重点：既要指出双方哪里做得不对，也要表扬双方做得好的地方（比如都在乎对方），语气要软萌、幽默、可爱但一针见血。",
      "advice": "【喵喵和好方案】用猫咪口吻（如本喵、喵呜）可爱地给出具体的、可执行的哄人或和好步骤（比如抱抱、买好吃的、具体的道歉话术）。",
      "prevention": "【喵喵预防计划】用猫咪口吻（如本喵、喵呜）可爱地针对这次的原因，给出下次避免同类争吵的注意事项。"
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

// [新增] 双人裁决 AI 逻辑
export const judgeJointConflict = async (
  p1_name: string, p1_reason: string, p1_point: string,
  p2_name: string, p2_reason: string, p2_point: string
): Promise<{ mergedReason: string } & JudgeResult> => {
  
// 2. 在 judgeJointConflict 函数中 (同理更新)：
  const prompt = `
    你是一只“喵喵法官”。两位铲屎官(${p1_name} 和 ${p2_name})吵架了。
    
    【${p1_name}】说: ${p1_reason} (观点: ${p1_point})
    【${p2_name}】说: ${p2_reason} (观点: ${p2_point})

    任务：
    1. 生成一个完全客观、不带情绪的“争吵原因总结”(mergedReason)。
    2. 进行公正裁决，风格要可爱俏皮。

    请以JSON格式输出：
    {
      "mergedReason": "客观原因总结",
      "hisFault": 整数 0-100 (${p1_name}的过错),
      "herFault": 整数 0-100 (${p2_name}的过错),
      "analysis": "【喵喵复盘】请用猫咪口吻（如本喵、喵呜）可爱地分析吵架原因。重点：既要指出双方哪里做得不对，也要表扬双方做得好的地方（比如都在乎对方），语气要软萌、幽默、可爱但一针见血。",
      "advice": "【喵喵和好方案】用猫咪口吻（如本喵、喵呜）可爱地给出具体的、可执行的哄人或和好步骤（比如抱抱、买好吃的、具体的道歉话术）。",
      "prevention": "【喵喵预防计划】用猫咪口吻（如本喵、喵呜）可爱地针对这次的原因，给出下次避免同类争吵的注意事项。"
    
    }
  `;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    if (!text) throw new Error("AI无响应");
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Joint Judge Error:", error);
    return {
      mergedReason: "双方各执一词，场面一度十分混乱",
      hisFault: 50, herFault: 50,
      analysis: "本喵CPU烧了，你们别吵了！",
      advice: "互相抱抱。", prevention: "少说话多做事。"
    };
  }
};



