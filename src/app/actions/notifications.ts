"use server";

import webpush from "web-push";

// Set VAPID details
webpush.setVapidDetails(
  "mailto:admin@xianxia-rpg.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// In-memory storage (in production, use a database)
const subscriptions = new Map<string, any>();

export async function subscribeUser(userId: string, sub: any) {
  subscriptions.set(userId, sub);
  return { success: true };
}

export async function unsubscribeUser(userId: string) {
  subscriptions.delete(userId);
  return { success: true };
}

export async function sendStaminaFullNotification(userId: string) {
  const subscription = subscriptions.get(userId);

  if (!subscription) {
    console.log("No subscription found for user:", userId);
    return { success: false, error: "No subscription available" };
  }

  try {
    await webpush.sendNotification(
      subscription as any,
      JSON.stringify({
        title: "Thể Lực Đã Phục Hồi! ⚡",
        body: "Thể lực của bạn đã hồi phục đầy đủ. Tiếp tục hành trình tu tiên!",
        icon: "/icon-192.png",
        url: "/",
      })
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error sending push notification:", error);

    // If subscription is invalid, remove it
    if (error.statusCode === 410) {
      subscriptions.delete(userId);
    }

    return { success: false, error: "Failed to send notification" };
  }
}

export async function getSubscriptionStatus(userId: string) {
  return { hasSubscription: subscriptions.has(userId) };
}
