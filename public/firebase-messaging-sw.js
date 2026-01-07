importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Firebase config (must be hardcoded in SW)
firebase.initializeApp({
  apiKey: "AIzaSyDkAO8lpkJ1husFl67OAs8zFpHUqmhfDQw",
  authDomain: "lystaria-chat.firebaseapp.com",
  projectId: "lystaria-chat",
  storageBucket: "ystaria-chat.firebasestorage.app",
  messagingSenderId: "157751563622",
  appId: "1:157751563622:web:6034f54ec665d3129a64a7",
});

const messaging = firebase.messaging();

// ✅ DATA-ONLY notifications (prevents the duplicate + weird 404 one)
messaging.onBackgroundMessage((payload) => {
  console.log("Background message received:", payload);

  const title = payload?.data?.title || "Lystaria";
  const body = payload?.data?.message || "Tap to open.";
  const url = payload?.data?.url || "/";

  const notificationOptions = {
    body,
    icon: "/icons/icon-180.png",
    badge: "/icons/icon-180.png",
    data: { url },
  };

  return self.registration.showNotification(title, notificationOptions);
});

// ✅ Safer click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event?.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If a tab is already open, focus it
      for (const client of allClients) {
        if ("focus" in client) return client.focus();
      }

      // Otherwise open a new tab
      return clients.openWindow(url);
    })()
  );
});