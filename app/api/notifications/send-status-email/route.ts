import { NextRequest, NextResponse } from 'next/server';
import { sendIssueStatusEmailNotification, EmailNotificationPayload } from '@/lib/emailService';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import defaultConfig from '../../../../firebase-applet-config.json';

export const dynamic = 'force-dynamic';

function getAdminDb() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultConfig.projectId;
  const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || defaultConfig.firestoreDatabaseId;

  const adminApp = !getApps().length ? initializeApp({ projectId }) : getApp();
  return getFirestore(adminApp, databaseId);
}

// POST: Trigger email notification to citizen
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ticketId,
      issueId,
      recipientEmail,
      previousStatus = 'Submitted',
      newStatus,
      issueTitle,
      category,
      locationAddress,
      notes,
      performedBy,
      resolutionSummary,
    } = body;

    if (!ticketId || !recipientEmail || !newStatus) {
      return NextResponse.json(
        { error: 'Missing required parameters: ticketId, recipientEmail, and newStatus are required.' },
        { status: 400 }
      );
    }

    const payload: EmailNotificationPayload = {
      ticketId,
      issueId,
      recipientEmail,
      previousStatus,
      newStatus,
      issueTitle: issueTitle || 'Civic Issue',
      category: category || 'Municipal Services',
      locationAddress: locationAddress || 'Civic District',
      notes,
      performedBy: performedBy || 'Municipal Authority',
      resolutionSummary,
    };

    const result = await sendIssueStatusEmailNotification(payload);

    // Audit log
    try {
      await addDoc(collection(db, 'auditLogs'), {
        timestamp: new Date().toISOString(),
        userId: performedBy || 'notification_system',
        action: 'NOTIFICATION_EMAIL_SENT',
        portal: 'system',
        status: 'SUCCESS',
        details: `Dispatched status transition notification email to ${recipientEmail} for Ticket #${ticketId} (${previousStatus} ➔ ${newStatus})`,
      });
    } catch {
      try {
        const adminDb = getAdminDb();
        await adminDb.collection('auditLogs').add({
          timestamp: new Date().toISOString(),
          userId: performedBy || 'notification_system',
          action: 'NOTIFICATION_EMAIL_SENT',
          portal: 'system',
          status: 'SUCCESS',
          details: `Dispatched status transition notification email to ${recipientEmail} for Ticket #${ticketId} (${previousStatus} ➔ ${newStatus})`,
        });
      } catch (e) {
        console.warn('Audit log write error for notification:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notification email dispatched to citizen (${recipientEmail})`,
      notification: result,
    });
  } catch (error: any) {
    console.error('Error dispatching notification email:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch email notification' },
      { status: 500 }
    );
  }
}

// GET: Retrieve sent notifications for a citizen or ticket
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const recipientEmail = searchParams.get('recipientEmail');
    const ticketId = searchParams.get('ticketId');
    const limitCount = parseInt(searchParams.get('limit') || '50', 10);

    let notifications: any[] = [];

    try {
      let q = collection(db, 'emailNotifications');
      const snapshot = await getDocs(q);
      notifications = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
    } catch (clientErr) {
      console.warn('Client DB fetch notifications offline, trying admin DB:', clientErr);
      try {
        const adminDb = getAdminDb();
        const snap = await adminDb.collection('emailNotifications').get();
        notifications = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      } catch (adminErr) {
        console.error('Admin DB fetch error:', adminErr);
      }
    }

    // Filter in-memory
    if (recipientEmail) {
      const emailLower = recipientEmail.toLowerCase().trim();
      notifications = notifications.filter(
        (n) => (n.recipientEmail || '').toLowerCase().trim() === emailLower
      );
    }

    if (ticketId) {
      const ticketLower = ticketId.toLowerCase().trim();
      notifications = notifications.filter(
        (n) => (n.ticketId || '').toLowerCase().trim() === ticketLower
      );
    }

    // Sort descending by sentAt
    notifications.sort((a, b) => {
      const timeA = new Date(a.sentAt || 0).getTime();
      const timeB = new Date(b.sentAt || 0).getTime();
      return timeB - timeA;
    });

    if (limitCount > 0) {
      notifications = notifications.slice(0, limitCount);
    }

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (err: any) {
    console.error('Error querying email notifications:', err);
    return NextResponse.json({ success: true, count: 0, notifications: [] });
  }
}
