import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });

    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md")) return NextResponse.json({ text: await file.text() });
    if (!name.endsWith(".pdf")) return NextResponse.json({ error: "Please upload a PDF, TXT, or Markdown file." }, { status: 400 });

    const pdfParse = (await import("pdf-parse")).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    const text = result.text?.replace(/\s+/g, " ").trim();
    if (!text) return NextResponse.json({ error: "No selectable text was found in this PDF." }, { status: 422 });
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "The file could not be read. Try another PDF or paste the notes directly." }, { status: 500 });
  }
}
