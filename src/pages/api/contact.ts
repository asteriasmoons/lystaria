import type { APIRoute } from "astro";
import nodemailer from "nodemailer";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function verifyEmailWithEmailable(email: string, apiKey: string) {
  const url = new URL("https://api.emailable.com/v1/verify");
  url.searchParams.set("email", email);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data && typeof data.message === "string"
        ? data.message
        : "Email verification failed.";
    throw new Error(`Emailable error (${res.status}): ${message}`);
  }

  return data;
}

// Very small in-memory rate limit (works fine for personal sites)
// Note: resets on deploy/restart
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string) {
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const max = 5;

  const existing = hits.get(ip);
  if (!existing || existing.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= max) return { ok: false };

  existing.count += 1;
  hits.set(ip, existing);
  return { ok: true };
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = clientAddress || "unknown";
    const rl = rateLimit(ip);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again in a minute." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();

    // Honeypot (optional): if you add a hidden field called "website" in the form, bots fill it
    const website = String(body.website || "").trim();
    if (website) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Name, email, and message are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isEmail(email)) {
      return new Response(JSON.stringify({ error: "Please enter a valid email address." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const EMAILABLE_API_KEY = requireEnv("EMAILABLE_API_KEY");

    const verification = await verifyEmailWithEmailable(email, EMAILABLE_API_KEY);

    const state = String(verification?.state || "").toLowerCase();
    const disposable = Boolean(verification?.disposable);
    const reason = String(verification?.reason || "");
    const didYouMean = String(verification?.did_you_mean || "").trim();

    if (disposable) {
      return new Response(JSON.stringify({ error: "Disposable email addresses are not allowed." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (state === "undeliverable") {
      return new Response(
        JSON.stringify({
          error: didYouMean
            ? `That email address could not be verified. Did you mean ${didYouMean}?`
            : "That email address could not be verified.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (state === "risky") {
      return new Response(JSON.stringify({ error: "Please use a less risky email address." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (state === "unknown") {
      return new Response(
        JSON.stringify({
          error: reason === "timeout"
            ? "We could not verify that email address right now. Please try again in a moment."
            : "We could not verify that email address right now.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const SMTP_HOST = requireEnv("SMTP_HOST");
    const SMTP_PORT = Number(requireEnv("SMTP_PORT"));
    const SMTP_USER = requireEnv("SMTP_USER");
    const SMTP_PASS = requireEnv("SMTP_PASS");
    const CONTACT_TO = requireEnv("CONTACT_TO"); // set to info@lystaria.im
    const CONTACT_FROM = requireEnv("CONTACT_FROM"); // usually same as SMTP_USER
    
    console.log("SMTP CONFIG", {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  user: SMTP_USER ? "set" : "missing",
  pass: SMTP_PASS ? "set" : "missing",
  emailableKey: EMAILABLE_API_KEY ? "set" : "missing",
  to: CONTACT_TO,
  from: CONTACT_FROM,
});

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 true, 587 false
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    
    await transporter.verify();

    const subject = `Lystaria Contact: ${name}`;
    const text =
      `New contact form message\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n\n` +
      `Message:\n${message}\n`;

    await transporter.sendMail({
      from: CONTACT_FROM,
      to: CONTACT_TO,
      replyTo: email,
      subject,
      text,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("contact api error:", err?.message || err);
    return new Response(JSON.stringify({ error: "Failed to send message." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};