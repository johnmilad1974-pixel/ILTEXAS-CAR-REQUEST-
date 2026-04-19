import { collection, addDoc, query, where, getDocs, onSnapshot, runTransaction, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Reservation } from '../types';
import { areIntervalsOverlapping, isSameMonth, isSameYear } from 'date-fns';

export const reservationsRef = collection(db, 'reservations');

export async function createReservation(reservation: Omit<Reservation, 'id'>) {
  return await runTransaction(db, async (transaction) => {
    const q = query(
      reservationsRef,
      where('carId', '==', reservation.carId),
      where('status', '==', 'approved')
    );
    
    const snapshot = await getDocs(q);
    const existingReservations = snapshot.docs.map(doc => doc.data() as Reservation);

    const isOverlapping = existingReservations.some(res => {
      return areIntervalsOverlapping(
        { start: new Date(reservation.startDate), end: new Date(reservation.endDate) },
        { start: new Date(res.startDate), end: new Date(res.endDate) },
        { inclusive: true }
      );
    });

    if (isOverlapping) {
      throw new Error('Vehicle is no longer available for the selected dates.');
    }

    const newDocRef = doc(reservationsRef);
    const data = { ...reservation, id: newDocRef.id };
    transaction.set(newDocRef, data);
    return newDocRef;
  });
}

export async function updateReservation(id: string, reservation: Partial<Reservation>) {
  const docRef = doc(db, 'reservations', id);
  return await updateDoc(docRef, reservation);
}

export async function deleteReservation(id: string) {
  const docRef = doc(db, 'reservations', id);
  return await deleteDoc(docRef);
}

export async function archiveOldReservations() {
  const snapshot = await getDocs(reservationsRef);
  const now = new Date();
  const batch = writeBatch(db);
  const archivesRef = collection(db, 'archives_reservations');
  let count = 0;

  for (const d of snapshot.docs) {
    const data = d.data() as Reservation;
    const resDate = new Date(data.startDate);
    // Move to archives if NOT in the current month AND year
    if (!isSameMonth(resDate, now) || !isSameYear(resDate, now)) {
      const archiveDocRef = doc(archivesRef);
      batch.set(archiveDocRef, { ...data, archivedAt: Date.now() });
      batch.delete(d.ref);
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
  return count;
}

export function subscribeToReservations(callback: (reservations: Reservation[]) => void) {
  return onSnapshot(reservationsRef, (snapshot) => {
    const reservations = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    } as Reservation));
    callback(reservations);
  }, (error) => {
    console.error("Firestore Subscription Error:", error);
    if (error.message.includes("permissions")) {
      alert("Database Access Error: Please ensure you have entered the access code correctly and that your internet connection is stable. If this persists, contact the administrator.");
    }
  });
}
