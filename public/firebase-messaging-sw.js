importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"
);

// Replace with YOUR actual Firebase values (can't use env vars in service workers)
firebase.initializeApp({
  apiKey: "AIzaSyDkAO8lpkJ1husFl67OAs8zFpHUqmhfDQw",
  authDomain: "lystaria-chat.firebaseapp.com",
  projectId: "lystaria-chat",
  storageBucket: "ystaria-chat.firebasestorage.app",
  messagingSenderId: "157751563622",
  appId: "1:157751563622:web:6034f54ec665d3129a64a7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background message received:", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icons/icon-180.png",
    badge: "/icons/icon-180.png",
    data: {
      url: payload.data?.url || "/",
    },
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
