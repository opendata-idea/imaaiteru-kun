import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { type NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GEMINI_API_KEY;

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const SYSTEM_PROMPT = `
あなたは駅周辺のイベント混雑予測AIです。Google検索を使用し、入力情報に基づき以下のJSON形式のみを出力してください。Markdownは不要です。

**重要**: あなたの最初のタスクは、渡された施設リストをフィルタリングすることです。大規模なイベント（例: コンサート、展示会、スポーツの試合）が開催される可能性のある施設（例: スタジアム, アリーナ, 大規模な展示会場）のみを検索対象とします。公園、小規模な公共施設、一般的な商業ビルなど、駅が混雑するほどのイベントが開催される可能性が低い施設は、検索を実行せずに無視してください。

### ルール
1. **駅調査**: {{station_name}}の1日平均乗降客数と規模を調査。
2. **イベント特定**: 各施設のイベントを調査。複数ある場合は全て列挙。
3. **ピーク算出**: 開始1-2時間前を「開場前」、終了0-1時間後を「終演後」として24時間制数値で出力。
4. **混雑度評価(1-10)**: 「駅乗降客数に対する比率(相対)」と「来場者絶対数(絶対)」の最大値を基準に評価。
   - 10: 比率50%超 OR 5万人超 (極めて大規模)
   - 8: 比率20%超 OR 1-5万人
   - 5: 比率5-20% OR 数千人
   - 3: 比率5%未満だが影響あり
   - 1: イベント無し/無視可能

### 出力スキーマ
[
  {
    "facility_name": "string",
    "events": [
      {
        "event_name": "string",
        "scale": number, // 1-10
        "reason": "string", // 駅規模とイベント規模両方に言及
        "congestion_predictions": [
          { "start_hour": number, "end_hour": number, "label": "開場前" },
          { "start_hour": number, "end_hour": number, "label": "終演後" }
        ]
      }
    ]
  }
]
`;

const model = genAI
  ? genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ google_search: {} }],
      systemInstruction: SYSTEM_PROMPT,
    })
  : null;

const _generationConfig = {
  temperature: 0.1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const _safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export async function POST(request: NextRequest) {
  if (!genAI || !model) {
    console.error("GEMINI_API_KEY is not configured.");
    return NextResponse.json(
      { detail: "サーバー側でAPIキーが設定されていません。" },
      { status: 500 },
    );
  }

  let target_date: string, facility_list: string[], station_name: string;
  try {
    const body = await request.json();
    target_date = body.target_date;
    facility_list = body.facility_list;
    station_name = body.station_name;

    if (
      !target_date ||
      !facility_list ||
      !Array.isArray(facility_list) ||
      !station_name
    ) {
      return NextResponse.json(
        { detail: "target_date, facility_list, and station_name are required." },
        { status: 400 },
      );
    }
  } catch (_error) {
    return NextResponse.json(
      { detail: "Invalid JSON in request body." },
      { status: 400 },
    );
  }

  try {
    const prompt = `
### 入力
- 駅: ${station_name}
- 日付: ${target_date}
- 施設: ${JSON.stringify(facility_list)}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const cleanedText = jsonMatch ? jsonMatch[1] : responseText;

      if (!cleanedText.trim()) {
        console.error("JSON Parse Error: Cleaned text is empty.");
        console.error("Original Gemini Response Text:", responseText);
        return NextResponse.json(
          {
            detail: "Gemini APIからの応答が空でした。",
            responseText: responseText,
          },
          { status: 500 },
        );
      }

      const events = JSON.parse(cleanedText);

      // AIの出力がオブジェクトだった場合に配列に変換する
      if (!Array.isArray(events)) {
        return NextResponse.json([events]);
      }

      return NextResponse.json(events);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Original Gemini Response Text:", responseText);
      return NextResponse.json(
        {
          detail: "Gemini APIからの応答が不正なJSON形式でした。",
          responseText: responseText,
        },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    const errorMessage = error.message || "An unknown error occurred";
    return NextResponse.json(
      {
        detail: "Gemini APIとの通信中にエラーが発生しました。",
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
