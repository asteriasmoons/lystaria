import type { APIRoute } from "astro";
import admin from "firebase-admin";

function getPrivateEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function initAdmin() {
  if (admin.apps.length) return;

  const projectId = getPrivateEnv("FIREBASE_PROJECT_ID");
  const clientEmail = getPrivateEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = getPrivateEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const databaseURL = getPrivateEnv("FIREBASE_DATABASE_URL");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL,
  });
}

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true, route: "/api/push/send.json" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    initAdmin();

    // Simple bearer auth from GitHub Action
    const auth = request.headers.get("authorization") || "";
    const expected = `Bearer ${getPrivateEnv("PUSH_WEBHOOK_SECRET")}`;
    if (auth !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "New post");
    const url = String(body.url || "/");
    const message = String(body.message || "A new post was published.");

    // Read tokens from RTDB
    const snap = await admin.database().ref("push-tokens").once("value");
    const tokensObj = snap.val() || {};

    const tokens: string[] = Object.values(tokensObj)
      .map((v: any) => v?.token)
      .filter(Boolean);

    if (!tokens.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "No tokens" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // ✅ DATA-ONLY payload (prevents the extra auto-notification)
    // Your service worker will read: payload.data.title / payload.data.message / payload.data.url
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        title,
        message,
        url,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        sent: res.successCount,
        failed: res.failureCount,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};