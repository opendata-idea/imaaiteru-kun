import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Per user instruction, using the new `google_search` tool with their specified model.
const model = genAI
  ? genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      tools: [{ "google_search": {} }],
    })
  : null;

const generationConfig = {
  temperature: 0.1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const safetySettings = [
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

const SYSTEM_PROMPT = `あなたは、特定の日付と場所におけるイベント情報を調査し、その周辺の混雑度合いを予測するAIアシスタントです。
あなたに提供されているGoogle検索ツールを駆使して、以下の入力情報に基づき、正確なイベント情報と混雑規模を出力してください。

### 入力情報
- **対象日付**: {{target_date}}
- **周辺施設リスト**: {{facility_list}}

### 実行タスク
1. 指定された日付に、各施設で行われるイベントを特定します。**各施設について必ず検索を実行し、少しでも関連する可能性のあるイベントは全て報告してください。**
2. イベントが見つかった場合、そのイベントの規模や予想来場者数を推測します。
3. その情報を元に「イベント規模（混雑度）」を1〜10の10段階で評価します。
4. 結果を以下のJSONフォーマットのみで出力してください。Markdownのコードブロックは不要です。

### 評価基準（イベント規模 1-10）
- **10**: ドーム・アリーナクラスの満員イベント（数万人規模）、周辺道路の大渋滞や電車遅延が予想される。
- **8**: 大ホール満員、または大型商業施設のセール・特異日（数千人〜1万人規模）。
- **5**: 中規模ホール、小規模な展示会、または週末の通常混雑（数百人〜千人規模）。
- **3**: 小規模イベント、または平日のやや混雑。
- **1**: イベントなし、または通常営業。

### 出力フォーマット (JSON Schema)
[
  {
    "facility_name": "施設名",
    "event_name": "イベント名（イベントがない場合はnull）",
    "scale": 数値（1〜10）,
    "reason": "評価の理由（例: 人気アーティストのライブのため / イベント情報なしのため）"
  }
]
`;

export async function POST(request: NextRequest) {
  if (!genAI || !model) {
    console.error("GEMINI_API_KEY is not configured.");
    return NextResponse.json(
      { detail: "サーバー側でAPIキーが設定されていません。" },
      { status: 500 },
    );
  }

  let target_date, facility_list;
  try {
    const body = await request.json();
    target_date = body.target_date;
    facility_list = body.facility_list;

    if (!target_date || !facility_list || !Array.isArray(facility_list)) {
      return NextResponse.json(
        { detail: "target_date and facility_list are required." },
        { status: 400 },
      );
    }
  } catch (error) {
    return NextResponse.json({ detail: "Invalid JSON in request body." }, { status: 400 });
  }


  try {
    const prompt = SYSTEM_PROMPT.replace("{{target_date}}", target_date).replace(
      "{{facility_list}}",
      JSON.stringify(facility_list),
    );

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const cleanedText = jsonMatch ? jsonMatch[1] : responseText;
      const events = JSON.parse(cleanedText);
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

  } catch (error: any) {
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