import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured.");

      return NextResponse.json(
        {
          ok: false,
          error: "MODERATION_NOT_CONFIGURED",
        },
        { status: 500 }
      );
    }

    const json = await request.json();
    const text = typeof json?.text === "string" ? json.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error: "EMPTY_TEXT",
        },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "OpenAI moderation request failed:",
        response.status,
        errorText
      );

      return NextResponse.json(
        {
          ok: false,
          error: "MODERATION_REQUEST_FAILED",
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const result = data?.results?.[0];

    if (!result) {
      console.error("OpenAI moderation returned no result.");

      return NextResponse.json(
        {
          ok: false,
          error: "MODERATION_RESULT_MISSING",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      allowed: !result.flagged,
    });
  } catch (error) {
    console.error("moderate-comment API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "MODERATION_INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}