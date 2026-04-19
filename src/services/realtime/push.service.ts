import * as admin from 'firebase-admin';
import { logger } from '@utils/logger';
import userModel from '@models/user/user.model';

// ─── Types ──────────────────────────────────────────────────────────

type Platform = 'ios' | 'android' | 'web';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

interface SendResult {
  successCount: number;
  failureCount: number;
}

interface MulticastResult extends SendResult {
  invalidTokens: string[];
}

/** FCM error codes that indicate a permanently invalid token. */
const INVALID_TOKEN_CODES = new Set(['messaging/invalid-registration-token', 'messaging/registration-token-not-registered']);

// ─── Service ────────────────────────────────────────────────────────

class PushNotificationService {
  private static instance: PushNotificationService;
  private initialized = false;

  private constructor() {
    this.initFirebase();
  }

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  public isEnabled(): boolean {
    return this.initialized;
  }

  // ─── Firebase Init ────────────────────────────────────────────────

  private initFirebase(): void {
    try {
      if (admin.apps.length > 0) {
        this.initialized = true;
        return;
      }

      const credential = this.resolveCredential();
      if (!credential) {
        logger.warn(
          '⚠️  Firebase not configured — push notifications disabled. ' +
            'Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY',
        );
        return;
      }

      admin.initializeApp({ credential });
      this.initialized = true;
      logger.info('✅ Firebase Admin initialized');
    } catch (error: any) {
      logger.error(`Firebase Admin initialization failed: ${error.message}`);
      this.initialized = false;
    }
  }

  /** Resolve Firebase credential from env — file path takes priority over individual vars. */
  private resolveCredential(): admin.credential.Credential | null {
    const { FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (FIREBASE_SERVICE_ACCOUNT_PATH) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return admin.credential.cert(require(FIREBASE_SERVICE_ACCOUNT_PATH));
    }

    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      return admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    }

    return null;
  }

  // ─── Token Management ─────────────────────────────────────────────

  /** Register (upsert) a device token. Same deviceId always holds one token. */
  public async registerToken(userId: string, token: string, deviceId: string, platform: Platform): Promise<void> {
    await userModel.updateOne({ _id: userId }, { $pull: { fcmTokens: { deviceId } } });
    await userModel.updateOne({ _id: userId }, { $push: { fcmTokens: { token, deviceId, platform, createdAt: new Date() } } });
    logger.info(`FCM token registered — user: ${userId}, device: ${deviceId}, platform: ${platform}`);
  }

  /** Unregister a device token (e.g. on logout). */
  public async unregisterToken(userId: string, deviceId: string): Promise<void> {
    await userModel.updateOne({ _id: userId }, { $pull: { fcmTokens: { deviceId } } });
    logger.info(`FCM token unregistered — user: ${userId}, device: ${deviceId}`);
  }

  /** Remove all tokens for a user (e.g. on account deletion). */
  public async removeAllTokens(userId: string): Promise<void> {
    await userModel.updateOne({ _id: userId }, { $set: { fcmTokens: [] } });
  }

  // ─── Send ─────────────────────────────────────────────────────────

  /** Send a push notification to every device of a single user. */
  public async sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
    if (!this.initialized) return { successCount: 0, failureCount: 0 };

    const user = await userModel.findById(userId).select('fcmTokens').lean();
    const tokens = user?.fcmTokens?.map(t => t.token) ?? [];
    if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

    const result = await this.sendMulticast(tokens, payload);
    await this.pruneInvalidTokensForUser(userId, result.invalidTokens);
    return result;
  }

  /** Send a push notification to multiple users at once. */
  public async sendToUsers(userIds: string[], payload: PushPayload): Promise<SendResult> {
    if (!this.initialized || userIds.length === 0) return { successCount: 0, failureCount: 0 };

    const users = await userModel
      .find({ _id: { $in: userIds } })
      .select('fcmTokens')
      .lean();

    // Flatten into token → userId pairs for cleanup tracking
    const tokenEntries: { token: string; userId: string }[] = [];
    for (const user of users) {
      for (const t of user.fcmTokens ?? []) {
        tokenEntries.push({ token: t.token, userId: (user._id as any).toString() });
      }
    }
    if (tokenEntries.length === 0) return { successCount: 0, failureCount: 0 };

    const tokens = tokenEntries.map(e => e.token);
    const result = await this.sendMulticast(tokens, payload);
    await this.pruneInvalidTokensByUserMap(tokenEntries, result.invalidTokens);
    return result;
  }

  // ─── Internal ─────────────────────────────────────────────────────

  /** Core multicast send via FCM. */
  private async sendMulticast(tokens: string[], payload: PushPayload): Promise<MulticastResult> {
    if (tokens.length === 0) return { successCount: 0, failureCount: 0, invalidTokens: [] };

    try {
      const message = this.buildMessage(tokens, payload);
      const response = await admin.messaging().sendEachForMulticast(message);

      const invalidTokens = response.responses.reduce<string[]>((acc, resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          const token = tokens[idx] as string | undefined;
          logger.warn(`FCM failed for token ${token?.substring(0, 12)}…: ${code} — ${resp.error?.message}`);
          if (token && code && INVALID_TOKEN_CODES.has(code)) acc.push(token);
        }
        return acc;
      }, []);

      logger.info(`FCM multicast: ${response.successCount} sent, ${response.failureCount} failed (${invalidTokens.length} stale)`);
      return { successCount: response.successCount, failureCount: response.failureCount, invalidTokens };
    } catch (error: any) {
      logger.error(`FCM multicast error: ${error.message}`);
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
  }

  /** Build the platform-optimized FCM multicast message. */
  private buildMessage(tokens: string[], payload: PushPayload): admin.messaging.MulticastMessage {
    return {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data ?? {},

      // Android — wake device immediately, show on lock screen
      android: {
        priority: 'high' as const,
        ttl: 0,
        notification: {
          sound: 'default',
          channelId: 'frame_notifications',
          priority: 'high' as const,
          defaultVibrateTimings: true,
          defaultSound: true,
          visibility: 'public' as const,
        },
      },

      // iOS — high priority, break through Focus mode
      apns: {
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: 'default',
            badge: 1,
            contentAvailable: true,
            mutableContent: true,
            interruptionLevel: 'active',
          },
        },
      },

      // Web — urgent, stay visible
      webpush: {
        headers: { Urgency: 'high', TTL: '0' },
        notification: { icon: '/icon-192x192.png', badge: '/badge-72x72.png', requireInteraction: true },
        fcmOptions: { link: '/' },
      },
    };
  }

  // ─── Token Cleanup ────────────────────────────────────────────────

  /** Remove invalid tokens for a single user. */
  private async pruneInvalidTokensForUser(userId: string, invalidTokens: string[]): Promise<void> {
    if (invalidTokens.length === 0) return;
    await userModel.updateOne({ _id: userId }, { $pull: { fcmTokens: { token: { $in: invalidTokens } } } });
    logger.info(`Pruned ${invalidTokens.length} stale FCM token(s) for user ${userId}`);
  }

  /** Remove invalid tokens mapped back to their respective users. */
  private async pruneInvalidTokensByUserMap(tokenEntries: { token: string; userId: string }[], invalidTokens: string[]): Promise<void> {
    if (invalidTokens.length === 0) return;

    const invalidSet = new Set(invalidTokens);
    const byUser = new Map<string, string[]>();

    for (const { token, userId } of tokenEntries) {
      if (invalidSet.has(token)) {
        const list = byUser.get(userId) ?? [];
        list.push(token);
        byUser.set(userId, list);
      }
    }

    await Promise.all(
      Array.from(byUser.entries()).map(([uid, tokens]) => userModel.updateOne({ _id: uid }, { $pull: { fcmTokens: { token: { $in: tokens } } } })),
    );
  }
}

export default PushNotificationService;
