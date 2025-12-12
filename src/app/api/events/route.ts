import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { type NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GEMINI_API_KEY;

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Per user instruction, using the new `google_search` tool with their specified model.
const model = genAI
  ? genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ google_search: {} }],
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

const SYSTEM_PROMPT = `あなたは、特定の日付と場所におけるイベント情報を調査し、その周辺の混雑度合いを予測するAIアシスタントです。
あなたに提供されているGoogle検索ツールを駆使して、以下の入力情報に基づき、正確なイベント情報と混雑規模を出力してください。

### 入力情報
- **対象駅**: {{station_name}}
- **対象日付**: {{target_date}}
- **周辺施設リスト**: {{facility_list}}

### 実行タスク
1. まず、対象駅（{{station_name}}）の1日あたりの平均乗降客数や駅の構造（例：主要なハブ駅か、ローカル駅か）を調査します。
2. 次に、指定された日付に、各周辺施設で行われるイベントを特定します。**1つの施設で複数のイベントが見つかった場合は、それぞれを個別のイベントとして報告してください。**
3. イベントが見つかった場合、そのイベントごとに開始時刻と終了時刻、規模、予想来場者数を推測します。
4. イベントごとに、その開始時刻と終了時刻を考慮し、混雑のピーク時間帯を算出します。**開始時刻の1〜2時間前**を「開場前」、**終了時刻の0〜1時間後**を「終演後」の混雑として、それぞれ開始時間と終了時間を24時間表記の数値で出力してください。
5. 以下の2つの指標を総合的に考慮して、「総合混雑度」を1〜10の10段階で評価します。
    1. **相対的インパクト**: 駅の1日の乗降客数に対するイベントの予想来場者数の「比率」。
    2. **絶対的インパクト**: イベントの予想来場者数の「絶対数」。
   評価理由には、これらの両方の観点から言及してください。
6. 結果を以下のJSONフォーマットのみで出力してください。Markdownのコードブロックは不要です。

### 評価基準（総合混雑度 1-10）
混雑度は「相対的インパクト（駅の乗降客数との比率）」と「絶対的インパクト（来場者数の絶対数）」の両面から評価します。
- **相対評価の例**: 地方のローカル駅（乗降客数 5000人/日）での1000人規模のイベントは、比率が20%に達するため高い混雑度になります。
- **絶対評価の例**: 大宮駅のような巨大ターミナル駅でも、5万人規模のアリーナライブが開催されれば、来場者数の絶対的な大きさから極めて高い混雑度と評価されます。

- **10**: イベント来場者数が駅の乗降客数の50%を超える**か、または**来場者数の絶対数が5万人を超えるような、極めて大規模な集客が見込まれる場合。
- **8**: イベント来場者数が駅の乗降客数の20%〜50%に相当する**か、または**来場者数の絶対数が1万人〜5万人程度の場合。
- **5**: イベント来場者数が駅の乗降客数の5%〜20%に相当する**か、または**来場者数の絶対数が数千人規模の場合。
- **3**: イベント来場者数が駅の乗降客数の5%未満だが、無視できない規模の場合。
- **1**: イベントがない、またはイベントの規模が駅のキャパシティに対して完全に無視できるほど小さい場合。

### 出力フォーマット (JSON Schema)
各施設について、以下の形式のオブジェクトを要素とする配列を返してください。
[
  {
    "facility_name": "施設名",
    "events": [
      {
        "event_name": "イベント名",
        "scale": 数値（1〜10）,
        "reason": "評価の理由（駅の規模とイベント内容の両方に言及）",
        "congestion_predictions": [
          {
            "start_hour": 17,
            "end_hour": 18,
            "label": "開場前"
          },
          {
            "start_hour": 21,
            "end_hour": 22,
            "label": "終演後"
          }
        ]
      }
    ]
  }
]
- 1つの施設で複数のイベントがある場合は、\`events\` 配列に複数のオブジェクトを含めてください。
- イベントが見つからなかった施設については、\`events\` 配列を空（[]）にしてください。
`;

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
    const prompt = SYSTEM_PROMPT.replace("{{target_date}}", target_date)
      .replace("{{facility_list}}", JSON.stringify(facility_list))
      .replace("{{station_name}}", station_name);

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
