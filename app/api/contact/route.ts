import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/sendgrid";
import { CONTACT_EMAIL_RE, CONTACT_LIMITS, CONTACT_TOPICS } from "@/lib/marketing/pages/contact";

const NOTIFY_EMAIL = process.env.CONTACT_NOTIFY_EMAIL || "support@latinmusicmastery.com";
const VALID_SUBJECTS: readonly string[] = CONTACT_TOPICS.map((t) => t.subject);

const RECEIVED = { success: true, message: "Your message has been received. We will get back to you shortly." };

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object") throw new Error();
  } catch {
    return bad("Invalid request body.");
  }

  // Honeypot field the form hides from people; bots fill it. Pretend it worked.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json(RECEIVED, { status: 200 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length < 2 || name.length > CONTACT_LIMITS.name) {
    return bad(`Name must be between 2 and ${CONTACT_LIMITS.name} characters.`);
  }
  if (email.length > CONTACT_LIMITS.email || !CONTACT_EMAIL_RE.test(email)) {
    return bad("A valid email address is required.");
  }
  if (!VALID_SUBJECTS.includes(subject)) {
    return bad("Please select a valid subject.");
  }
  if (message.length < 10 || message.length > CONTACT_LIMITS.message) {
    return bad(`Message must be between 10 and ${CONTACT_LIMITS.message} characters.`);
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error: insertError } = await supabase
    .from("contact_submissions")
    .insert({ name, email, subject, message })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[contact] failed to store submission", insertError);
    return NextResponse.json(
      { error: "We couldn't send your message. Please try again or email us directly." },
      { status: 500 }
    );
  }

  // The message is saved at this point, so a failed notification is logged,
  // not reported to the sender; unnotified rows keep notified_at null.
  try {
    const result = await sendEmail({
      to: [NOTIFY_EMAIL],
      replyTo: email,
      subject: `[Contact] ${subject} from ${name}`,
      text: `From: ${name} <${email}>\nTopic: ${subject}\n\n${message}\n`,
      html:
        `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br>` +
        `<strong>Topic:</strong> ${escapeHtml(subject)}</p>` +
        `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` +
        `<p style="color:#888;font-size:12px">Reply to this email to answer ${escapeHtml(name)} directly.</p>`,
    });
    if (result.sent > 0) {
      await supabase
        .from("contact_submissions")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      console.error("[contact] notification email failed", { id: row.id, errors: result.errors });
    }
  } catch (err) {
    console.error("[contact] notification email failed", { id: row.id, err });
  }

  return NextResponse.json(RECEIVED, { status: 200 });
}
