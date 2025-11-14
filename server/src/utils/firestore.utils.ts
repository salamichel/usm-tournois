import { Timestamp } from 'firebase-admin/firestore';

/**
 * Converts Firestore Timestamps to ISO date strings recursively
 */
export function convertTimestamps(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Firestore Timestamp
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map((item) => convertTimestamps(item));
  }

  // Handle Objects
  if (typeof data === 'object') {
    const converted: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        converted[key] = convertTimestamps(data[key]);
      }
    }
    return converted;
  }

  // Return primitives as-is
  return data;
}

/**
 * Converts Firestore document data to plain object with ISO date strings
 */
export function convertDocumentData(doc: FirebaseFirestore.DocumentSnapshot): any {
  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  return convertTimestamps({ id: doc.id, ...data });
}
