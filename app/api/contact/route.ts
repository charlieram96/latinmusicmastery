import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { name, email, subject, message } = body;

    // Validate required fields 
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name is required and must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (
      !email ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const validSubjects = [
      "General Inquiry",
      "Technical Support",
      "Billing",
      "Partnership",
      "Feedback",
    ];

    if (!subject || !validSubjects.includes(subject)) {
      return NextResponse.json(
        { error: "Please select a valid subject." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return NextResponse.json(
        { error: "Message is required and must be at least 10 characters." },
        { status: 400 }
      );
    }

    // TODO: Store in Supabase contact_submissions table
    // TODO: Send notification email

    return NextResponse.json(
      { success: true, message: "Your message has been received. We will get back to you shortly." },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
